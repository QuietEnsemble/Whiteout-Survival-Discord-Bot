const { Events, PermissionFlagsBits } = require('discord.js');
const { handleError, getUserInfo } = require('../functions/utility/commonFunctions');

/**
 * Permissions the bot must have in the interaction channel to function correctly.
 */
const REQUIRED_BOT_PERMISSIONS = [
    { flag: PermissionFlagsBits.ViewChannel,       name: 'View Channel' },
    { flag: PermissionFlagsBits.SendMessages,      name: 'Send Messages' },
    { flag: PermissionFlagsBits.EmbedLinks,        name: 'Embed Links' },
    { flag: PermissionFlagsBits.UseExternalEmojis, name: 'Use External Emojis' },
];

/**
 * Returns an array of missing permission names for the bot in the interaction's channel.
 * Returns an empty array if all required permissions are present or if the check is not applicable.
 * @param {import('discord.js').Interaction} interaction
 * @returns {string[]}
 */
function getMissingBotPermissions(interaction) {
    if (!interaction.guild) return []; // DMs have no permission requirements

    // A null channel in a guild context means the bot likely lacks View Channel
    if (!interaction.channel) return ['View Channel'];

    const botMember = interaction.guild.members.me;
    if (!botMember) return [];

    const channelPerms = interaction.channel.permissionsFor(botMember);
    if (!channelPerms) return [];

    return REQUIRED_BOT_PERMISSIONS
        .filter(({ flag }) => !channelPerms.has(flag))
        .map(({ name }) => name);
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Only handle slash commands here
        if (!interaction.isChatInputCommand()) return;

        // Pre-flight check: ensure the bot has required permissions in this channel
        const missingPermissions = getMissingBotPermissions(interaction);
        if (missingPermissions.length > 0) {
            const { lang } = getUserInfo(interaction.user.id);
            const permissionList = missingPermissions.map(p => `\`${p}\``).join(', ');
            const message = lang.common.botMissingPermissions.replace('{permissions}', permissionList);
            return interaction.reply({ content: message, ephemeral: true });
        }

        const command = interaction.client.commands?.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            // Execute the command
            await command.execute(interaction);

        } catch (error) {
            console.error(`Error executing ${interaction.commandName}:`, error);
            await handleError(interaction, null, error, `${interaction.commandName} command`);
        }
    }
};
