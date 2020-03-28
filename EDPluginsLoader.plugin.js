//META{"name":"EDPluginsLoader"}*//

const { existsSync, writeFileSync, readdirSync, readFileSync } = require('fs')
const { join } = require('path')
const { Module } = require('module')

const settingsCommit = '2da7c49264b840ba4bfcb435c722e3a79666f18d'
const pluginCommit   = settingsCommit

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
    getName() { return 'ED Plugins Loader' }
    getDescription() { return 'Load ED plugins in BetterDiscord' }
    getVersion() { return '0.0.6' }
    getAuthor() { return 'Juby210' }
    getRawUrl() { return 'https://raw.githubusercontent.com/Juby210/EDPluginsLoader/master/EDPluginsLoader.plugin.js' }

    async start() {
        const pluginjs = join(__dirname, '..', 'plugin.js')
        if (!existsSync(pluginjs) || this.loadData('plugin_commit') != pluginCommit) {
            c.log('Updating plugin class')
            let res = await fetch(`https://raw.githubusercontent.com/joe27g/EnhancedDiscord/${pluginCommit}/plugin.js`)
            if (res.status != 200) return console.error('[EDPL] Failed to update plugin class!', res)
            let tab = '        '
            let s = (await res.text()).replace(`this.unload();\r\n${tab}delete require.cache[require.resolve(\`./plugins/\${this.id}\`)];\r
${tab}const newPlugin = require(\`./plugins/\${this.id}\`);\r\n${tab}ED.plugins[this.id] = newPlugin;\r\n${tab}newPlugin.id = this.id;\r
${tab}return newPlugin.load()`, 'ED._reloadPlugin(this.id)')

            writeFileSync(pluginjs, s)
            this.saveData('plugin_commit', pluginCommit)
        }

        const settingsjs = join(__dirname, 'ed_settings.js')
        if(!existsSync(settingsjs) || this.loadData('settings_commit') != settingsCommit) {
            c.log('Updating ed settings')
            let res = await fetch(`https://raw.githubusercontent.com/joe27g/EnhancedDiscord/${settingsCommit}/plugins/ed_settings.js`)
            if (res.status != 200) return console.error('[EDPL] Failed to update ed settings!', res)
            let s = `// This file is auto updated by EDPluginsLoader, don\'t edit this manually\n` + (await res.text())
                .replace('const BD = ', '// const BD = ')
                .replace('Allows EnhancedDiscord to load BetterDiscord plugins natively. Reload (ctrl+r) for changes to take effect."',
                    'This option is disabled, because you are using EDPluginsLoader.",disabled:true')
                .replace(/this\.props\.plugin\.settings\.enabled = /g, 'let _x=this.props.plugin.settings;_x.enabled=')
                .replace(/ = this\.props\.plugin\.settings/g, '=_x')

            if (window.powercord) { // fixes for powercord
                s = s.replace('devIndex + 2', 'devIndex + 6')
                    .replace('.findModule("Sizes")', '.findModuleByDisplayName("DropdownButton")')
            }

            writeFileSync(settingsjs, s)
            this.saveData('settings_commit', settingsCommit)
        }

        window.ED = { plugins: {}, version: '2.8' }
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
                what[methodName].displayName = _displayName
                delete what[methodName].unpatch
            }
            what[methodName].displayName = "patched " + (what[methodName].displayName || methodName)
            what[methodName].unpatch = cancel
            return cancel
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
        window.EDApi.loadPluginSettings = pluginName => {
            const pl = ED.plugins[pluginName]
            if (!pl) return null

            if (!ED.config[pluginName]) {
                EDApi.savePluginSettings(pluginName, pl.defaultSettings || {enabled: !pl.disabledByDefault})
            }
            return ED.config[pluginName]
        }
        window.EDApi.savePluginSettings = (pluginName, data) => {
            const pl = ED.plugins[pluginName]
            if (!pl) return null

            const _x = window.ED.config
            _x[pluginName] = data
            ED.config = _x
        }

        window.ED._loadPlugin = loadPlugin
        window.ED._reloadPlugin = id => {
            const plugin = window.ED.plugins[id]
            if(!plugin) return
            try {
                plugin.unload()
            } catch(e) {
                c.error(e, plugin)
            }
            delete require.cache[require.resolve(`./${id}`)]
            const newPlugin = require(`./${id}`)
            window.ED.plugins[id] = newPlugin
            newPlugin.id = id
            newPlugin.load()
        }

        if (!window.powercord) Module._extensions['.js'] = (module, filename) => {
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

        c.log(`Loading plugins...`)
        for (const id in plugins) {
            if (ED.config[id] && ED.config[id].enabled === false) continue
            if (!plugins[id].preload) continue
            loadPlugin(plugins[id])
        }
        for (const id in plugins) {
            if (ED.config[id] && ED.config[id].enabled === false) continue
            if (plugins[id].preload) continue
            if (ED.config[id] && ED.config[id].enabled !== true && plugins[id].disabledByDefault) {
                plugins[id].settings.enabled = false; continue;
            }
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

        if (window.ZeresPluginLibrary) {
            ZeresPluginLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), this.getRawUrl())
        } else if (window.BDFDB) {
            if(!window.PluginUpdates) window.PluginUpdates = { plugins: {} }
            window.PluginUpdates.plugins[this.getRawUrl()] = { name: this.getName(), raw: this.getRawUrl(), version: this.getVersion() }
            BDFDB.PluginUtils.checkUpdate(this.getName(), this.getRawUrl())
        }
    }
    stop() {
        for (const id in window.ED.plugins) {
            if(window.ED.config[id] && window.ED.config[id].enabled == false) continue
            try {
                window.ED.plugins[id].unload()
            } catch(e) {
                c.error(e, window.ED.plugins[id])
            }
        }

        delete window.ED
        delete window.EDApi
    }

    loadData(s) {
        return BdApi.loadData('EDPLoader', s)
    }
    saveData(s, v) {
        return BdApi.saveData('EDPLoader', s, v)
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
