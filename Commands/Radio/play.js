const Discord = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js')

exports.help = {
  name: 'play',
  helpname: 'play',
  description: 'Permet de lancer la radio',
  help: 'play '
};

exports.run = async (bot, message, args, config) => {
    const checkPerm = async (message, commandName) => {
        if (config.owners.includes(message.author.id)) {
            return true;
        }

        const publicStatut = await new Promise((resolve, reject) => {
            db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
                if (err) reject(err);
                resolve(!!row);
            });
        });

        if (publicStatut) {
            const checkPublicCmd = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
                    ['public', commandName, message.guild.id],
                    (err, row) => {
                        if (err) reject(err);
                        resolve(!!row);
                    }
                );
            });

            if (checkPublicCmd) {
                return true;
            }
        }

        try {
            const checkUserWl = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                });
            });

            if (checkUserWl) {
                return true;
            }

            const checkDbOwner = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                });
            });

            if (checkDbOwner) {
                return true;
            }

            const roles = message.member.roles.cache.map(role => role.id);

            const permissions = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?',
                    [...roles, message.guild.id],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows.map(row => row.perm));
                    }
                );
            });

            if (permissions.length === 0) {
                return false;
            }

            const checkCmdPermLevel = await new Promise((resolve, reject) => {
                db.all(
                    'SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?',
                    [...permissions, message.guild.id],
                    (err, rows) => {
                        if (err) reject(err);
                        resolve(rows.map(row => row.command));
                    }
                );
            });

            return checkCmdPermLevel.includes(commandName);
        } catch (error) {
            console.error('Erreur lors de la vérification des permissions:', error);
            return false;
        }
    };

    if (!(await checkPerm(message, exports.help.name))) {
        const noacces = new EmbedBuilder()
            .setDescription("Vous n'avez pas la permission d'utiliser cette commande.")
            .setColor(config.color);
        return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } });
    }
 
    const novoice = new EmbedBuilder()
    .setDescription("Vous n'êtes pas dans un salon vocal.")
    .setColor(config.color);

    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply({embeds: [novoice], allowedMentions: { repliedUser: true }});
    }

    db.get('SELECT url FROM radio WHERE guild = ?', [message.guild.id], (err, row) => {
        if (err) {
            console.error(err);
        }

        const url = row.url;

        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const ffmpeg = require('ffmpeg-static');
        const { spawn } = require('child_process');
        const { Readable } = require('stream');

        const process = spawn(ffmpeg, [
            '-i', url,
            '-analyzeduration', '0',
            '-loglevel', '0',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'ignore'] });

        const audioStream = process.stdout;
        const resource = createAudioResource(Readable.from(audioStream), {
            inputType: StreamType.Raw
        });

        connection.subscribe(player);
        player.play(resource);

        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`La radio est lancée sur ${url}`);
        message.reply({ embeds: [embed] });

        player.on('error', error => {
            console.error(error);
        });
        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });
    });
};