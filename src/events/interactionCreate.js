const { Events } = require('discord.js');
const { handleError } = require('../functions/utility/commonFunctions');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Only handle slash commands here
        if (!interaction.isChatInputCommand()) return;

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
