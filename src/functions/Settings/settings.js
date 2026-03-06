const {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize
} = require('discord.js');
const { settingsQueries } = require('../utility/database');
const { createChangeLanguageButton } = require('./language');
const { createManageAdminsButton } = require('./admin');
const { createAutoDeleteButton } = require('./autoClean');
const { createFeatureAccessButton } = require('./featureAccess');
const { createEmojiThemeButton } = require('./theme/emojis');
const { createDBMigrationButton } = require('./migration');
const { createBackupButton } = require('./backup/backup');
const { createBackToPanelButton } = require('../Panel/backToPanel');
const { createAutoUpdateButton } = require('./autoUpdate');
const { getUserInfo, assertUserMatches, handleError, hasPermission } = require('../utility/commonFunctions');
const { getComponentEmoji, getEmojiMapForUser } = require('../utility/emojis');


/**
 * Creates a settings button
 * @param {string} userId - ID of the user who can interact with this button
 * @param {Object} lang - Language object for localized text
 * @returns {ButtonBuilder} The settings button
 */
function createSettingsButton(userId, lang = {}) {
    return new ButtonBuilder()
        .setCustomId(`settings_${userId}`)
        .setLabel(lang.panel.mainPage.buttons.settings)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(getComponentEmoji(getEmojiMapForUser(userId), '1038'));
}

/**
 * Creates settings components for display
 * @param {Object} interaction - Interaction object
 * @param {Object} adminData - Admin data from database
 * @param {string} userLang - User's language code
 * @param {Object} lang - Language object for localized text
 * @returns {Array} Array of components ready for display
 */
function createSettingsComponents(interaction, adminData, lang) {
    // Non-admin users: show only language and emoji theme
    if (!adminData) {
        const actionRow = new ActionRowBuilder().addComponents(
            createChangeLanguageButton(interaction.user.id, lang),
            createEmojiThemeButton(interaction.user.id, lang),
            createBackToPanelButton(interaction.user.id, lang)
        );

        return [
            new ContainerBuilder()
                .setAccentColor(0xe67e22)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `${lang.settings.mainPage.content.title}\n` +
                        `${lang.settings.mainPage.content.languageField.name}\n` +
                        `${lang.settings.mainPage.content.languageField.value}\n` +
                        `${lang.settings.mainPage.content.themeField.name}\n` +
                        `${lang.settings.mainPage.content.themeField.value}\n`
                    )
                ).addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
                ).addActionRowComponents(actionRow)
        ];
    }

    // Admin users: full settings panel
    // Get auto_delete setting
    const settings = settingsQueries.getSettings.get();
    const autoDelete = settings?.auto_delete ?? 1;
    const hasFullAccess = hasPermission(adminData);

    // Create action row with settings buttons
    const actionRow = new ActionRowBuilder()
        .addComponents(
            createChangeLanguageButton(interaction.user.id, lang)
        );

    const secondRow = new ActionRowBuilder()

    // Add manage admins button (disabled if user is not owner)
    const manageAdminsButton = createManageAdminsButton(interaction.user.id, lang);
    if (!hasFullAccess) {
        manageAdminsButton.setDisabled(true);
    }
    actionRow.addComponents(manageAdminsButton);


    // Add emoji theme button
    const emojiThemeButton = createEmojiThemeButton(interaction.user.id, lang);
    actionRow.addComponents(emojiThemeButton);

    // Add Feature Access button (owner only)
    const featureAccessButton = createFeatureAccessButton(interaction.user.id, lang);
    if (!hasFullAccess) {
        featureAccessButton.setDisabled(true);
    }
    actionRow.addComponents(featureAccessButton);

    // Create second action row for database button
    const migrationButton = createDBMigrationButton(interaction.user.id, lang);
    if (!hasFullAccess) {
        migrationButton.setDisabled(true);
    }
    secondRow.addComponents(migrationButton);

    const backupButton = createBackupButton(interaction.user.id, lang);
    if (!hasFullAccess) {
        backupButton.setDisabled(true);
    }
    secondRow.addComponents(backupButton);

    // Add auto-update button (owner only)
    const autoUpdateButton = createAutoUpdateButton(interaction.user.id, lang);
    if (!hasFullAccess) {
        autoUpdateButton.setDisabled(true);
    }
    secondRow.addComponents(autoUpdateButton);

    // Add auto-delete toggle button
    const autoDeleteButton = createAutoDeleteButton(interaction.user.id, lang, autoDelete);
    if (!hasFullAccess) {
        autoDeleteButton.setDisabled(true);
    }
    secondRow.addComponents(autoDeleteButton);

    secondRow.addComponents(createBackToPanelButton(interaction.user.id, lang));

    const newSection = [
        new ContainerBuilder()
            .setAccentColor(0xe67e22)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${lang.settings.mainPage.content.title}\n` +
                    `${lang.settings.mainPage.content.description}\n` +

                    `${lang.settings.mainPage.content.languageField.name}\n` +
                    `${lang.settings.mainPage.content.languageField.value}\n` +

                    `${lang.settings.mainPage.content.adminManagementField.name}\n` +
                    `${lang.settings.mainPage.content.adminManagementField.value}\n` +

                    `${lang.settings.mainPage.content.themeField.name}\n` +
                    `${lang.settings.mainPage.content.themeField.value}\n` +

                    `${lang.settings.mainPage.content.featureAccessField.name}\n` +
                    `${lang.settings.mainPage.content.featureAccessField.value}\n` +

                    `${lang.settings.mainPage.content.mergeField.name}\n` +
                    `${lang.settings.mainPage.content.mergeField.value}\n` +

                    `${lang.settings.mainPage.content.backupField.name}\n` +
                    `${lang.settings.mainPage.content.backupField.value}\n` +

                    `${lang.settings.mainPage.content.autoUpdateField.name}\n` +
                    `${lang.settings.mainPage.content.autoUpdateField.value}\n` +

                    `${lang.settings.mainPage.content.autoDeleteField.name}\n` +
                    `${lang.settings.mainPage.content.autoDeleteField.value.replace('{autoDelete}', autoDelete ? lang.settings.mainPage.content.enabled : lang.settings.mainPage.content.disabled)}\n`
                )
            ).addSeparatorComponents(
                new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true)
            ).addActionRowComponents(
                actionRow,
                secondRow
            )
    ];

    return newSection;
}

/**
 * Handles settings button interaction and updates embed to show settings
 * @param {import('discord.js').ButtonInteraction} interaction 
 */
async function handleSettingsButton(interaction) {
    // Get user's language preference
    const { adminData, lang } = getUserInfo(interaction.user.id);
    try {
        // Extract user ID from custom ID
        const expectedUserId = interaction.customId.split('_')[1];

        // Check if the interaction user matches the expected user
        if (!(await assertUserMatches(interaction, expectedUserId, lang))) return;

        // Create settings components
        const newSection = createSettingsComponents(interaction, adminData, lang);

        await interaction.update({
            components: newSection,
            flags: MessageFlags.IsComponentsV2
        });

    } catch (error) {
        await handleError(interaction, lang, error, 'handleSettingsButton');
    }
}

module.exports = {
    createSettingsButton,
    handleSettingsButton,
    createSettingsComponents
};