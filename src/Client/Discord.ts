import { ActivityType, Client, Routes } from "discord.js";
import { REST } from "@discordjs/rest";
import fs from "fs";
import path from "path";
import Config from "../Config";
import { Logger } from "../Logger";
import { CommandBuilder } from "../util/CommandBuilder";

export class Discord extends Client {
    public command = new Map<string, CommandBuilder>();
    constructor() {
        super({
            intents: ["Guilds"],
            presence: {
                status: "online",
                activities: [
                    {
                        name: "with Discord API",
                        type: ActivityType.Streaming,
                    }
                ],
            }
        });
        this.on("ready", () => {
            Logger.info(`Logged in as ${this.user?.tag} ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB ENV: ${process.env.NODE_ENV}`);
        });
        this.on("error", Logger.error);
        this.on("interactionCreate", async (interaction) => {
            if (!interaction.isCommand()) return;
            const command = this.command.get(interaction.commandName);
            if (!command) return;
            try {
                await command.run(this, interaction);
            } catch (e) {
                Logger.error(e);
                await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
            }
        });
    }
    public init(token: string) {
        if (!token) {
            throw new Error("No token provided");
        } else {
            this.login(token);
            this._registerCommand();
        }
    }
    public async _registerCommand() {
        try {
            const [slashFiles] = await Promise.all([
                fs.readdirSync(path.join(__dirname, "../Commands")),
            ]);
            const commands = [];
            for (const folder of slashFiles) {
                const commandsInFolder = fs.readdirSync(path.join(__dirname, `../Commands/${folder}`));
                for (const commandFile of commandsInFolder) {
                    const command = await import(`../Commands/${folder}/${commandFile}`).then((c) => c.default);
                    commands.push(command.data);
                    this.command.set(command.data.name, command);
                    Logger.debug(`Loaded Command: ${command.data.name}`);
                }
            }
            const rest = new REST({ version: '10' }).setToken(Config.TOKEN);
            Logger.info(`Started refreshing application (/) commands.`),
                await Promise.all([
                    rest.put(Routes.applicationGuildCommands(Config.CLIENT_ID, Config.GUILD_ID), { body: commands }).then(() => Logger.info(`Successfully reloaded application (/) commands.`))
                ]);
        }
        catch (e) {
            console.error(e);
        }
    }
}