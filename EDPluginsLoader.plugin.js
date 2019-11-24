//META{"name":"EDPluginsLoader"}*//

const { existsSync, openSync, writeFileSync, readdirSync, readFileSync } = require('fs')
const { join } = require('path')

// https://raw.githubusercontent.com/joe27g/EnhancedDiscord/master/LICENSE

const c = {
    log: function(msg, plugin) {
        if (plugin && plugin.name)
            console.log(`%c[EnhancedDiscord] %c[${plugin.name}]`, 'color: red;', `color: ${plugin.color}`, msg);
        else console.log('%c[EnhancedDiscord]', 'color: red;', msg);
    },
    info: function(msg, plugin) {
        if (plugin && plugin.name)
            console.info(`%c[EnhancedDiscord] %c[${plugin.name}]`, 'color: red;', `color: ${plugin.color}`, msg);
        else console.info('%c[EnhancedDiscord]', 'color: red;', msg);
    },
    warn: function(msg, plugin) {
        if (plugin && plugin.name)
            console.warn(`%c[EnhancedDiscord] %c[${plugin.name}]`, 'color: red;', `color: ${plugin.color}`, msg);
        else console.warn('%c[EnhancedDiscord]', 'color: red;', msg);
    },
    error: function(msg, plugin) {
        if (plugin && plugin.name)
            console.error(`%c[EnhancedDiscord] %c[${plugin.name}]`, 'color: red;', `color: ${plugin.color}`, msg);
        else console.error('%c[EnhancedDiscord]', 'color: red;', msg);
    },
    sleep: function(ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
}

class EDPluginsLoader {
	getName() { return "ED Plugins Loader" }
	getDescription() { return "Load ED plugins in BetterDiscord" }
	getVersion() { return "0.0.1" }
	getAuthor() { return "Juby210" }
    getRawUrl() { return "https://raw.githubusercontent.com/juby210-PL/EDPluginsLoader/master/EDPluginsLoader.plugin.js" }

    start() {
        const pluginjs = join(__dirname, '..', 'plugin.js')
        if(!existsSync(pluginjs)) {
            openSync(pluginjs, 'w')
            writeFileSync(pluginjs, 'module.exports = ' + String(Plugin))
        }

        window.ED = { plugins: {}, version: '2.6.2' }
        window.ED.localStorage = window.localStorage
        process.env.injDir = bdConfig.dataPath

        Object.defineProperty(window.ED, 'config', {
            get: () => {
                return this.loadData('ed_config') ? JSON.parse(this.loadData('ed_config')) : {}
            },
            set: (newSets = {}) => {
                this.saveData('ed_config', JSON.stringify(newSets))
                return newSets
            }
        })

        window.EDApi = { ...window.BdApi }
        window.EDApi.findModule = filter => {
            if(typeof filter == 'string') return BdApi.findModuleByProps(filter)
            return BdApi.findModule(filter)
        }
        window.EDApi.findAllModules = filter => {
            let f = filter
            if(typeof f == 'string') f = m => m[filter]
            return BdApi.findAllModules(f)
        }
        window.EDApi.monkeyPatch = (what, methodName, options) => {
            if(typeof options == 'function') options = { instead: options, silent: true }
            const _cancel = BdApi.monkeyPatch(what, methodName, options), _displayName = what[methodName].displayName
            const cancel = () => {
                _cancel()
                delete what[methodName].__monkeyPatched
                what[methodName].displayName = _displayName
            }
            what[methodName].__monkeyPatched = true
            what[methodName].displayName = "patched " + (what[methodName].displayName || methodName)
            what[methodName].unpatch = cancel
        }
        window.EDApi.formatString = (string, values) => {
            for (const val in values) {
                string = string.replace(new RegExp(`\\{\\{${val}\\}\\}`, 'g'), values[val])
            }
            return string
        }
        window.EDApi.escapeID = id => {
            return id.replace(/^[^a-z]+|[^\w-]+/gi, "")
        }

        window.ED._loadPlugin = loadPlugin
        window.ED._reloadPlugin = id => {
            const plugin = window.ED.plugins[id]
            if(!plugin) return
            plugin.unload()
            delete require.cache[require.resolve(`./${id}`)]
            const newPlugin = require(`./${id}`)
            window.ED.plugins[id] = newPlugin
            newPlugin.id = id
            newPlugin.load()
        }

        require('module').Module._extensions['.js'] = (module, filename) => {
            try {
                ContentManager.getContentRequire('plugin')(module, filename)
            } catch(e) {
                const content = readFileSync(filename, 'utf8')
                module._compile(stripBOM(content), filename)
            }
        }


        c.log(`v${window.ED.version} (Plugin v${this.getVersion()}) is running. Validating plugins...`)

        const pluginFiles = readdirSync(join(process.env.injDir, 'plugins'))
        const plugins = {}
        for (const i in pluginFiles) {
            if (!pluginFiles[i].endsWith('.js') || pluginFiles[i].endsWith('.plugin.js')) continue
            let p
            const pName = pluginFiles[i].replace(/\.js$/, '')
            try {
                p = require(join(process.env.injDir, 'plugins', pName));
                if (typeof p.name !== 'string' || typeof p.load !== 'function') {
                    throw new Error('Plugin must have a name and load() function.')
                }
                plugins[pName] = Object.assign(p, { id: pName })
            }
            catch (err) {
                c.warn(`Failed to load ${pluginFiles[i]}: ${err}\n${err.stack}`, p)
            }
        }
        for (const id in plugins) {
            if (!plugins[id] || !plugins[id].name || typeof plugins[id].load !== 'function') {
                c.info(`Skipping invalid plugin: ${id}`); delete plugins[id]; continue;
            }
            plugins[id].settings // this will set default settings in config if necessary
        }
        window.ED.plugins = plugins
        c.log(`Plugins validated.`)

        window.findModule = window.EDApi.findModule
        window.findModules = window.EDApi.findAllModules
        // TODO: window.findRawModule = window.EDApi.findRawModule
        window.monkeyPatch = window.EDApi.monkeyPatch

        if (window.ED.config.silentTyping) {
            window.EDApi.monkeyPatch(window.EDApi.findModule('startTyping'), 'startTyping', () => {});
        }

        if (window.ED.config.antiTrack !== false) {
            window.EDApi.monkeyPatch(window.EDApi.findModule('track'), 'track', () => {});
            const errReports = window.EDApi.findModule('collectWindowErrors');
            errReports.collectWindowErrors = false;
            window.EDApi.monkeyPatch(errReports, 'report', () => {});
        }

        c.log(`Loading plugins...`)
        for (const id in plugins) {
            if (window.ED.config[id] && window.ED.config[id].enabled === false) continue
            if (!plugins[id].preload) continue
            loadPlugin(plugins[id])
        }
        for (const id in plugins) {
            if (window.ED.config[id] && window.ED.config[id].enabled === false) continue
            if (plugins[id].preload) continue
            loadPlugin(plugins[id])
        }

        const ht = window.EDApi.findModule('hideToken');
        // prevent client from removing token from localstorage when dev tools is opened, or reverting your token if you change it
        window.EDApi.monkeyPatch(ht, 'hideToken', () => {});
        window.fixedShowToken = () => {
            // Only allow this to add a token, not replace it. This allows for changing of the token in dev tools.
            if (!window.ED.localStorage || window.ED.localStorage.getItem("token")) return;
            return window.ED.localStorage.setItem("token", '"'+ht.getToken()+'"');
        };
        window.EDApi.monkeyPatch(ht, 'showToken', window.fixedShowToken);
        if (!window.ED.localStorage.getItem("token") && ht.getToken())
            window.fixedShowToken(); // prevent you from being logged out for no reason
    
        // change the console warning to be more fun
        const wc = require('electron').remote.getCurrentWebContents();
        wc.removeAllListeners("devtools-opened");
        wc.on("devtools-opened", () => {
            console.log("%cHold Up!", "color: #FF5200; -webkit-text-stroke: 2px black; font-size: 72px; font-weight: bold;");
            console.log("%cIf you're reading this, you're probably smarter than most Discord developers.", "font-size: 16px;");
            console.log("%cPasting anything in here could actually improve the Discord client.", "font-size: 18px; font-weight: bold; color: red;");
            console.log("%cUnless you understand exactly what you're doing, keep this window open to browse our bad code.", "font-size: 16px;");
            console.log("%cIf you don't understand exactly what you're doing, you should come work with us: https://discordapp.com/jobs", "font-size: 16px;");
        });
    }
    stop() {
        for (const id in window.ED.plugins) {
            if(window.ED.config[id] && window.ED.config[id].enabled == false) continue
            window.ED.plugins[id].unload()
        }

        delete window.ED
        delete window.EDApi
    }

    loadData(s) {
        return BdApi.loadData("EDPLoader", s)
    }
    saveData(s, v) {
        return BdApi.saveData("EDPLoader", s, v)
    }
}

function stripBOM(content) {
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1)
    }
    return content
}

function loadPlugin(plugin) {
    try {
        if (plugin.preload)
            console.log(`%c[EnhancedDiscord] %c[PRELOAD] %cLoading plugin %c${plugin.name}`, 'color: red;', 'color: yellow;', '', `color: ${plugin.color}`, `by ${plugin.author}...`);
        else console.log(`%c[EnhancedDiscord] %cLoading plugin %c${plugin.name}`, 'color: red;', '', `color: ${plugin.color}`, `by ${plugin.author}...`);
        plugin.load();
    } catch(err) {
        c.error(`Failed to load:\n${err.stack}`, plugin);
    }
}

// https://github.com/joe27g/EnhancedDiscord/blob/master/plugin.js

/**
 * Plugin Class
 */
class Plugin {
    /**
     * Create your plugin, must have a name and load() function
     * @constructor
     * @param {object} options - Plugin options
     */
    constructor (opts = {}) {
        if (!opts.name || typeof opts.load !== 'function')
            return 'Invalid plugin. Needs a name and a load() function.';

        Object.assign(this, opts);
        if (!this.color)
            this.color = 'orange';
        if (!this.author)
            this.author = '<unknown>';
    }

    load () {}

    unload () {}

    reload () {
        ED._reloadPlugin(this.id)
    }

    /**
     * Send a decorated console.log prefixed with ED and your plugin name
     * @param {...string} msg - Message to be logged
     */
    log (...msg) {
        console.log(`%c[EnhancedDiscord] %c[${this.name}]`, 'color: red;', `color: ${this.color}`, ...msg);
    }
    /**
     * Send a decorated console.info prefixed with ED and your plugin name
     * @param {...string} msg - Message to be logged
     */
    info (...msg) {
        console.info(`%c[EnhancedDiscord] %c[${this.name}]`, 'color: red;', `color: ${this.color}`, ...msg);
    }
    /**
     * Send a decorated console.warn prefixed with ED and your plugin name
     * @param {...string} msg - Message to be logged
     */
    warn (...msg) {
        console.warn(`%c[EnhancedDiscord] %c[${this.name}]`, 'color: red;', `color: ${this.color}`, ...msg);
    }
    /**
     * Send a decorated console.error prefixed with ED and your plugin name
     * @param {...string} msg - Message to be logged
     */
    error (...msg) {
        console.error(`%c[EnhancedDiscord] %c[${this.name}]`, 'color: red;', `color: ${this.color}`, ...msg);
    }
    /**
     * Returns a Promise that resolves after ms milliseconds.
     * @param {number} ms - How long to wait before resolving the promise
     */
    sleep (ms) {
        return new Promise(resolve => {
            setTimeout(resolve, ms);
        });
    }
    get settings() {
        //this.log('getting settings');
        if (window.ED.config && window.ED.config[this.id])
            return window.ED.config[this.id];

        const final = {};
        if (this.config)
            for (const key in this.config)
                final[key] = this.config[key].default;
        return this.settings = final;
        //return final;
    }
    set settings(newSets = {}) {
        //this.log(__dirname, process.env.injDir);
        //console.log(`setting settings for ${this.id} to`, newSets);
        try {
            const gay = window.ED.config;
            gay[this.id] = newSets;
            window.ED.config = gay;
            //console.log(`set settings for ${this.id} to`, this.settings);
        } catch(err) {
            this.error(err);
        }
        return this.settings;
    }
}
