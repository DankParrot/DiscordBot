
const http = require('http')
const Hjson = require('hjson')
const fs = require('fs')
const util = require('util')


// DEV: clear caches in case of reload
delete require.cache[require.resolve('./db.js'), require.resolve('./api.js')]
var db = require('./db.js')
var api = require('./api.js')
var config = Hjson.parse(fs.readFileSync(__dirname + '/disquotes.hjson', {encoding: 'utf8'}))

module.exports.events = {
	message(msg) {
		db.logMessage(msg)
	},
	messageUpdate(old, msg) {
		db.logEdit(old, msg)
	},
	messageDelete(msg) {
		db.logDelete(msg)
	}
}

function sendQuote(channel, m, author) {
	channel.sendEmbed({
		//description: m.cleanContent,
		description: m.content,
		author: {
			name: author.username,
			icon_url: author.displayAvatarURL
			//icon_url: "http://dankparrot.xyz/i/dachn.png" // disquotes logo
		},
		footer: {
			text: "Disquotes"
		},
		//timestamp: m.createdAt
		timestamp: m.timestamp
	})
}

module.exports.commands = {
	// log debugging commands
	"dq.single": {
		reload: true,
		args: 1,
		tags: 'owner',
		async execute(e) {
			var m = await db.getMessage(e.args[0])
			var author = await e.client.fetchUser(m.author)
			sendQuote(e.channel, m, author)
		}
	},
	"dq.multi": {
		reload: true,
		args: 1,
		tags: 'owner',
		async execute(e) {
			var messages = await db.getMessages(e.channel.id, e.args[0], 4)
			for (var m of messages) {
				var author = await e.client.fetchUser(m.author)
				sendQuote(e.channel, m, author)
			}

		}
	},
	"quote": {
		args: [0, 1],
		reload: true,
		async execute(e) {
			if (e.args.length === 1) {
				var m = await db.getQuote(e.client, e.guild.id, e.args[0])
				var author = await e.client.fetchUser(m.messages[0].author)
				sendQuote(e.channel, m, author)
			} else {
				// !quote with no args means the user wants a new quote
				api.newQuote(e, config)
			}
		},
		error: 'Failed to find quote: `$0`'
	},
	"quote.add": {
		reload: true,
		args: 2,
		tags: 'owner',
		async execute(e) {
			// check to make sure that quote name is not already in use
			var list = await db.getQuoteNames(e.guild.id)
			if (list.includes(e.args[1])) {
				e.channel.send('Sorry, `' + e.args[1] + '` is already taken.')
				return
			}

			await db.addQuote(e)
			e.channel.send(`Added Quote \`${e.args[1]}\``)
		}
	},
	"quote.delete": {
		args: 1,
		tags: 'owner',
		async execute(e) {
			var test = await db.deleteQuote(e.guild.id, e.args[0])
			e.channel.send(`Deleted Quote: \`${e.args[0]}\``)
		},
		error: 'Failed to find and delete quote: `$0`'
	},
	"quotes": {
		async execute(e) {
			var list = await db.getQuoteNames(e.guild.id)
			e.channel.send(`Quotes: \`\`\`${list.join(', ')}\`\`\``)
		}
	}
}
