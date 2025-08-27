const db = require('../../Events/loadDatabase');

exports.help = {
  name: 'ghostping',
  helpname: 'ghostping <#01,#02,..>',
  description: "Permet de configurer le ghostping",
  help: 'ghostping <#01,#02,..>',
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
        db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.perm));
        });
      });

      if (permissions.length === 0) {
        return false;
      }

      const checkCmdPermLevel = await new Promise((resolve, reject) => {
        db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
          if (err) reject(err);
          resolve(rows.map(row => row.command));
        });
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
  return message.reply({embeds: [noacces], allowedMentions: { repliedUser: true }});
  }


  const channelId = args.join(' ').split(',').map(str => str.replace(/[<#> ]/g, '')).filter(Boolean);
  if (channelId.length === 0) return

  db.run(
    `CREATE TABLE IF NOT EXISTS ghostping (guild TEXT PRIMARY KEY, channels TEXT)`,
    [],
    (err) => {
      if (err) return message.reply("Une erreur est survenue.");
      db.run(
        `INSERT OR REPLACE INTO ghostping (guild, channels) VALUES (?, ?)`,
        [message.guild.id, channelId.join(',')],
        (err) => {
          if (err) return message.reply("Une erreur est survenue.");
          message.reply("Les salons pour le Ghostping : " + channelId.map(id => `<#${id}>`).join(', '));
        }
      );
    }
  );
};