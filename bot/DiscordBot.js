

const fs = require("fs")
const path = require("path")
const EventEmitter = require('events').EventEmitter

const Hjson = require('hjson')

const Discord = require("discord.js")

const Profile = require('./Profile.js')
const Config = require('./Config.js')
const Module = require('./Module.js')
const Command = require('./Command.js')
const TagManager = require('./TagManager.js')

class DiscordBot {

	constructor(cfg) {
		// disable flatfile logging until config is loaded
		// and log path is specified
		console.record = false

		this.config = new Config(cfg, {fatal: true})

		console.logdir = this.config.paths.logs
		console.record = true

		this.profile = new Profile(this.config.paths.profile, this.config)
		this.tagManager = new TagManager(this.profile.users, this.profile.guilds)

		this.commands = {}
		this.modules = {}

		this.createClient()

		this.loadAllModules()
	}

	// Instantiates the discord.js client
	createClient() {
		this.client = new Discord.Client(this.config.client || {})
		this.configureClient()
	}

	// Attaches core event listeners to the Discord.js client
	configureClient() {
		var commandRegex = new RegExp(`^${this.config.commandPrefix}(.+)`, "i")

		this.client.on("message", msg => {

			if (msg.author.id == this.client.user.id && !this.config.selfCommands) {
				// Bot can't accept commands from itself.
				return
			}

			var match = msg.content.match(commandRegex)
			if (match != null) {
				var rawCommand = match[1]

				this.executeCommand(rawCommand, msg)
			}

		})
	}

	async executeCommand(rawCommand, msg, checkTags = true) {
		var fullCommand = rawCommand.split(' ')
		var cmd = this.commands[fullCommand[0]]

		if (cmd) {

			// commands with {reload: true} will always reload
			// their module before executing. use only for
			// development and debugging purposes
			if (cmd.reload) {
				try {
					this.reloadModule(cmd.module.name, cmd.module.file)
					cmd = this.commands[fullCommand[0]]

					if (!cmd) return
				} catch (e) {
					console.error(e.stack)
					msg.channel.send(`An internal module reload error has occured.\n- ${e.name}: ${e.message}`, {code: 'diff'})
				}
			}

			cmd.invoke(this, fullCommand, msg, checkTags)
		}
	}


	/**
	 * loads module by file and name
	 * init specifies whether to
	 * call the module's init function
	 */
	loadModule(file, {init = true}) {
		try {
			this.modules[path.basename(file, path.extname(file))] = new Module(file, this, init)
		} catch (e) {
			if (e instanceof Error)
				console.error(e.stack)
		}
	}

	// removes a modules, doesn't detach event listeners
	// reloadAllModules() to remove straggling listeners
	unloadModule(name) {
		if (!this.modules[name]) return

		delete this.modules[name]

		for (var cmd in this.commands) {
			if (this.commands[cmd].module.name == name) {
				delete this.commands[cmd]
			}
		}
	}

	// loads all modules
	loadAllModules(init = true) {
		var dir = this.config.paths.modules
		fs.readdirSync(dir).forEach(file => {
			//var moduleName = file.match(/(.+?)(\.\w+)?$/)[1]
			this.loadModule(path.join(dir, file), init)
		});

		this.profile.save()

		console.info(`Finished loading ${Object.keys(this.modules).length} modules, and ${Object.keys(this.commands).length} commands.`)
	}

	/**
	 * reloads a module by name
	 * does not call init() again
	 * use reloadAllModules() if
	 * you want to upadate events
	 */
	reloadModule(name, path) {
		console.info("Reloading Module: " + name)
		if (this.modules[name]) {
			for (var c in this.commands) {
				var cmd = this.commands[c]
				if (cmd.module.name == name) {
					delete this.commands[c]
				}
			}
			delete this.modules[name]
		}

		this.loadModule(path, {init: false})
	}

	/**
	 * more effective than reloadModule
	 * as it allows init() to be re-called,
	 * however this will take loads of time
	 */
	reloadAllModules() {
		console.info("Reloading all modules.")

		this.client.removeAllListeners()
		this.commands = {}
		this.modules = {}

		this.loadAllModules()
		this.configureClient()
	}

	connect() {
		var token

		// "token" is either a file name or an acutal token string
		// tokens can be laoded from external files for security
		if (fs.existsSync(this.config.token)) {
			token = fs.readFileSync(this.config.token).toString()
		} else {
			token = this.config.token
		}

		console.log("Connecting to Discord.")

		this.client.login(token).catch((err) => {
			console.error(err)
		})
	}
}

module.exports = DiscordBot;
