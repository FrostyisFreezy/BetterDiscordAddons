/**
 * @name EditChannels
 * @authorId 278543574059057154
 * @invite Jx3TjNS
 * @donate https://www.paypal.me/MircoWittrien
 * @patreon https://www.patreon.com/MircoWittrien
 * @website https://github.com/mwittrien/BetterDiscordAddons/tree/master/Plugins/EditChannels
 * @source https://raw.githubusercontent.com/mwittrien/BetterDiscordAddons/master/Plugins/EditChannels/EditChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/mwittrien/BetterDiscordAddons/master/Plugins/EditChannels/EditChannels.plugin.js
 */

module.exports = (_ => {
	const config = {
		"info": {
			"name": "EditChannels",
			"author": "DevilBro",
			"version": "4.2.1",
			"description": "Allow you to rename and recolor channelnames"
		},
		"changeLog": {
			"improved": {
				"Reset Confirmation": "Trying to reset a channel will first ask for permission, holding Shift will skip this"
			}
		}
	};

	return !window.BDFDB_Global || (!window.BDFDB_Global.loaded && !window.BDFDB_Global.started) ? class {
		getName () {return config.info.name;}
		getAuthor () {return config.info.author;}
		getVersion () {return config.info.version;}
		getDescription () {return config.info.description;}
		
		load () {
			if (!window.BDFDB_Global || !Array.isArray(window.BDFDB_Global.pluginQueue)) window.BDFDB_Global = Object.assign({}, window.BDFDB_Global, {pluginQueue: []});
			if (!window.BDFDB_Global.downloadModal) {
				window.BDFDB_Global.downloadModal = true;
				BdApi.showConfirmationModal("Library Missing", `The library plugin needed for ${config.info.name} is missing. Please click "Download Now" to install it.`, {
					confirmText: "Download Now",
					cancelText: "Cancel",
					onCancel: _ => {delete window.BDFDB_Global.downloadModal;},
					onConfirm: _ => {
						delete window.BDFDB_Global.downloadModal;
						require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
							if (!e && b && b.indexOf(`* @name BDFDB`) > -1) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => {});
							else BdApi.alert("Error", "Could not download BDFDB library plugin, try again some time later.");
						});
					}
				});
			}
			if (!window.BDFDB_Global.pluginQueue.includes(config.info.name)) window.BDFDB_Global.pluginQueue.push(config.info.name);
		}
		start () {this.load();}
		stop () {}
		getSettingsPanel () {
			let template = document.createElement("template");
			template.innerHTML = `<div style="color: var(--header-primary); font-size: 16px; font-weight: 300; white-space: pre; line-height: 22px;">The library plugin needed for ${config.info.name} is missing.\nPlease click <a style="font-weight: 500;">Download Now</a> to install it.</div>`;
			template.content.firstElementChild.querySelector("a").addEventListener("click", _ => {
				require("request").get("https://mwittrien.github.io/BetterDiscordAddons/Library/0BDFDB.plugin.js", (e, r, b) => {
					if (!e && b && b.indexOf(`* @name BDFDB`) > -1) require("fs").writeFile(require("path").join(BdApi.Plugins.folder, "0BDFDB.plugin.js"), b, _ => {});
					else BdApi.alert("Error", "Could not download BDFDB library plugin, try again some time later.");
				});
			});
			return template.content.firstElementChild;
		}
	} : (([Plugin, BDFDB]) => {
		var changedChannels = {}, settings = {};
	
		return class EditChannels extends Plugin {
			onLoad () {
				this.defaults = {
					settings: {
						changeChannelIcon:		{value: true, 	inner: false,		description: "Change color of Channel Icon"},
						changeInChatTextarea:	{value: true, 	inner: true,		description: "Chat Textarea"},
						changeInMentions:		{value: true, 	inner: true,		description: "Mentions"},
						changeInChannelList:	{value: true, 	inner: true,		description: "Channel List"},
						changeInChannelHeader:	{value: true, 	inner: true,		description: "Channel Header"},
						changeInRecentMentions:	{value: true, 	inner: true,		description: "Recent Mentions Popout"},
						changeInAutoComplete:	{value: true, 	inner: true,		description: "Autocomplete Menu"},
						changeInAuditLog:		{value: true, 	inner: true,		description: "Audit Log"},
						changeInInviteLog:		{value: true, 	inner: true,		description: "Invite Log"},
						changeInQuickSwitcher:	{value: true, 	inner: true,		description: "Quick Switcher"}
					}
				};
			
				this.patchedModules = {
					before: {
						ChannelEditorContainer: "render",
						ChannelAutoComplete: "render",
						AutocompleteChannelResult: "render",
						AuditLog: "render",
						SettingsInvites: "render",
						HeaderBarContainer: "render",
						ChannelCategoryItem: "type",
						ChannelItem: "default",
						QuickSwitchChannelResult: "render",
						MessageContent: "type"
					},
					after: {
						AutocompleteChannelResult: "render",
						AuditLog: "render",
						HeaderBarContainer: "render",
						FocusRing: "default",
						ChannelItem: "default",
						QuickSwitchChannelResult: "render",
						RecentsChannelHeader: "default",
						ChannelMention: "ChannelMention"
					}
				};
				
				this.css = `
					${BDFDB.dotCN.messagespopoutchannelname}:hover > span[style*="color"],
					${BDFDB.dotCN.recentmentionschannelname}:hover > span[style*="color"] {
						text-decoration: underline;
					}
				`;
			}
			
			onStart () {
				let observer = new MutationObserver(_ => {this.changeAppTitle();});
				BDFDB.ObserverUtils.connect(this, document.head.querySelector("title"), {name: "appTitleObserver",instance: observer}, {childList: true});
				
				if (BDFDB.LibraryModules.AutocompleteOptions && BDFDB.LibraryModules.AutocompleteOptions.AUTOCOMPLETE_OPTIONS) BDFDB.PatchUtils.patch(this, BDFDB.LibraryModules.AutocompleteOptions.AUTOCOMPLETE_OPTIONS.CHANNELS, "queryResults", {after: e => {
					let channelArray = [];
					for (let id in changedChannels) if (changedChannels[id] && changedChannels[id].name) {
						let channel = BDFDB.LibraryModules.ChannelStore.getChannel(id);
						let category = channel && channel.parent_id && BDFDB.LibraryModules.ChannelStore.getChannel(channel.parent_id);
						let catData = category && changedChannels[category.id] || {};
						if (BDFDB.ChannelUtils.isTextChannel(channel) && channel.guild_id == e.methodArguments[0].guild_id) channelArray.push(Object.assign({
							lowerCaseName: changedChannels[id].name.toLowerCase(),
							lowerCaseCatName: catData && catData.name && catData.name.toLowerCase(),
							channel,
							category,
							catData
						}, changedChannels[id]));
					}
					channelArray = BDFDB.ArrayUtils.keySort(channelArray.filter(n => e.returnValue.channels.every(channel => channel.id != n.channel.id) && (n.lowerCaseName.indexOf(e.methodArguments[1]) != -1 || (n.lowerCaseCatName && n.lowerCaseCatName.indexOf(e.methodArguments[1]) != -1))), "lowerCaseName");
					e.returnValue.channels = [].concat(e.returnValue.channels, channelArray.map(n => n.channel)).slice(0, BDFDB.DiscordConstants.MAX_AUTOCOMPLETE_RESULTS);
				}});
				
				this.forceUpdateAll();
			}
			
			onStop () {
				this.forceUpdateAll();
			}

			getSettingsPanel (collapseStates = {}) {
				let settingsPanel, settingsItems = [];
				
				for (let key in settings) if (!this.defaults.settings[key].inner) settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
					type: "Switch",
					plugin: this,
					keys: ["settings", key],
					label: this.defaults.settings[key].description,
					value: settings[key]
				}));
				settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsPanelList, {
					title: "Change Channels in:",
					children: Object.keys(settings).map(key => this.defaults.settings[key].inner && BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsSaveItem, {
						type: "Switch",
						plugin: this,
						keys: ["settings", key],
						label: this.defaults.settings[key].description,
						value: settings[key]
					}))
				}));
				settingsItems.push(BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
					type: "Button",
					color: BDFDB.LibraryComponents.Button.Colors.RED,
					label: "Reset all Channels",
					onClick: _ => {
						BDFDB.ModalUtils.confirm(this, this.labels.confirm_resetall, _ => {
							BDFDB.DataUtils.remove(this, "channels");
							this.forceUpdateAll();
						});
					},
					children: BDFDB.LanguageUtils.LanguageStrings.RESET
				}));
				
				return settingsPanel = BDFDB.PluginUtils.createSettingsPanel(this, settingsItems);
			}

			onSettingsClosed () {
				if (this.SettingsUpdated) {
					delete this.SettingsUpdated;
					this.forceUpdateAll();
				}
			}
		
			forceUpdateAll (instant = false) {
				changedChannels = BDFDB.DataUtils.load(this, "channels");
				settings = BDFDB.DataUtils.get(this, "settings");
				
				this.changeAppTitle();
				BDFDB.PatchUtils.forceAllUpdates(this);
				BDFDB.ChannelUtils.rerenderAll(instant);
				BDFDB.ReactUtils.forceUpdate(BDFDB.ReactUtils.findOwner(document.querySelector(BDFDB.dotCN.app), {name: "Channel", unlimited: true}));
			}

			onChannelContextMenu (e) {
				if (e.instance.props.channel) {
					let [children, index] = BDFDB.ContextMenuUtils.findItem(e.returnvalue, {id: "devmode-copy-id", group: true});
					children.splice(index > -1 ? index : children.length, 0, BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuGroup, {
						children: BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
							label: this.labels.context_localchannelsettings,
							id: BDFDB.ContextMenuUtils.createItemId(this.name, "settings-submenu"),
							children: BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuGroup, {
								children: [
									BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
										label: this.labels.submenu_channelsettings,
										id: BDFDB.ContextMenuUtils.createItemId(this.name, "settings-change"),
										action: _ => {
											this.openChannelSettingsModal(e.instance.props.channel);
										}
									}),
									BDFDB.ContextMenuUtils.createItem(BDFDB.LibraryComponents.MenuItems.MenuItem, {
										label: this.labels.submenu_resetsettings,
										id: BDFDB.ContextMenuUtils.createItemId(this.name, "settings-reset"),
										color: BDFDB.LibraryComponents.MenuItems.Colors.DANGER,
										disabled: !changedChannels[e.instance.props.channel.id],
										action: event => {
											let remove = _ => {
												BDFDB.DataUtils.remove(this, "channels", e.instance.props.channel.id);
												this.forceUpdateAll(true);
											};
											if (event.shiftKey) remove();
											else BDFDB.ModalUtils.confirm(this, this.labels.confirm_reset, remove);
										}
									})
								]
							})
						})
					}));
				}
			}
			
			processChannelEditorContainer (e) {
				if (!e.instance.props.disabled && e.instance.props.channel && BDFDB.ChannelUtils.isTextChannel(e.instance.props.channel) && e.instance.props.type == BDFDB.DiscordConstants.TextareaTypes.NORMAL && settings.changeInChatTextarea) {
					let data = changedChannels[e.instance.props.channel.id];
					e.instance.props.placeholder = BDFDB.LanguageUtils.LanguageStringsFormat("TEXTAREA_PLACEHOLDER", `#${data && data.name || e.instance.props.channel.name}`);
				}
			}

			processAutocompleteChannelResult (e) {
				if (e.instance.props.channel && settings.changeInAutoComplete) {
					if (!e.returnvalue) {
						e.instance.props.channel = this.getChannelData(e.instance.props.channel.id);
						if (e.instance.props.category) e.instance.props.category = this.getChannelData(e.instance.props.category.id);
					}
					else {
						let channelName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.marginleft4]]});
						if (channelName) this.changeChannelColor(channelName, e.instance.props.channel.id);
						let channelIcon = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.autocompleteicon]]});
						if (channelIcon) this.changeChannelIconColor(channelIcon, e.instance.props.channel.id, {alpha: 0.6});
						if (e.instance.props.category) {
							let categoryName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.autocompletedescription]]});
							if (categoryName) this.changeChannelColor(categoryName, e.instance.props.category.id);
						}
					}
				}
			}

			processAuditLog (e) {
				let channel = BDFDB.ObjectUtils.get(e.instance, "props.log.options.channel");
				if (channel && settings.changeInAuditLog) {
					if (!e.returnvalue) e.instance.props.log.options.channel = this.getChannelData(channel.id);
					else {
						let channelName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["children", [["#" + channel.name]]]]});
						if (channelName) this.changeChannelColor(channelName, channel.id);
					}
				}
			}

			processSettingsInvites (e) {
				if (BDFDB.ObjectUtils.is(e.instance.props.invites) && settings.changeInInviteLog) {
					e.instance.props.invites = Object.assign({}, e.instance.props.invites);
					for (let id in e.instance.props.invites) e.instance.props.invites[id] = new BDFDB.DiscordObjects.Invite(Object.assign({}, e.instance.props.invites[id], {channel: this.getChannelData(e.instance.props.invites[id].channel.id)}));
				}
			}

			processHeaderBarContainer (e) {
				let channel = BDFDB.LibraryModules.ChannelStore.getChannel(e.instance.props.channelId);
				if (channel && BDFDB.ChannelUtils.isTextChannel(channel) && settings.changeInChannelHeader) {
					if (!e.returnvalue) {
						let channelName = BDFDB.ReactUtils.findChild(e.instance, {name: "Title"});
						if (channelName) {
							channelName.props.children = this.getChannelData(channel.id).name;
							this.changeChannelColor(channelName, channel.id);
						}
					}
					else {
						let [children, index] = BDFDB.ReactUtils.findParent(e.instance, {name: "Icon"});
						if (index > -1) {
							let icon = BDFDB.ReactUtils.createElement(children[index].props.icon, {
								className: BDFDB.disCN.channelheadericon
							});
							this.changeChannelIconColor(icon, channel.id, {alpha: 0.6});
							children[index] = BDFDB.ReactUtils.createElement("div", {
								className: BDFDB.disCN.channelheadericonwrapper,
								children: icon
							})
						}
					}
				}
			}

			processFocusRing (e) {
				if (e.returnvalue && e.returnvalue.props && e.returnvalue.props.className && e.returnvalue.props.className.indexOf(BDFDB.disCN.categoryiconvisibility) > -1 && settings.changeInChannelList) {
					let dataListId = BDFDB.ObjectUtils.get(e.returnvalue, "props.children.0.props.data-list-item-id");
					if (dataListId) {
						let channelId = dataListId.split("_").pop();
						let modify = {muted: BDFDB.LibraryModules.MutedUtils.isGuildOrCategoryOrChannelMuted(BDFDB.LibraryModules.LastGuildStore.getGuildId(), channelId)};
						let categoryName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.categoryname]]});
						if (categoryName) this.changeChannelColor(categoryName, channelId, modify);
						let categoryIcon = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.categoryicon]]});
						if (categoryIcon) this.changeChannelIconColor(categoryIcon, channelId, Object.assign({alpha: 0.6}, modify));
					}
				}
			}
			
			processChannelCategoryItem (e) {
				if (e.instance.props.channel && settings.changeInChannelList) e.instance.props.channel = this.getChannelData(e.instance.props.channel.id);
			}

			processChannelItem (e) {
				if (e.instance.props.channel && settings.changeInChannelList) {
					if (!e.returnvalue) e.instance.props.channel = this.getChannelData(e.instance.props.channel.id);
					else {
						let modify = BDFDB.ObjectUtils.extract(Object.assign({}, e.instance.props, e.instance.state), "muted", "locked", "selected", "unread", "connected", "hovered");
						let channelName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.channelname]]});
						if (channelName) this.changeChannelColor(channelName, e.instance.props.channel.id, modify);
						let channelIcon = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.channelicon]]});
						if (channelIcon) this.changeChannelIconColor(channelIcon, e.instance.props.channel.id, Object.assign({alpha: 0.6}, modify));
					}
				}
			}
			
			processQuickSwitchChannelResult (e) {
				if (e.instance.props.channel && settings.changeInQuickSwitcher) {
					if (!e.returnvalue) {
						e.instance.props.channel = this.getChannelData(e.instance.props.channel.id);
						if (e.instance.props.category) e.instance.props.category = this.getChannelData(e.instance.props.category.id);
					}
					else {
						let modify = BDFDB.ObjectUtils.extract(e.instance.props, "focused", "unread", "mentions");
						let channelName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.quickswitchresultmatch]]});
						if (channelName) this.changeChannelColor(channelName, e.instance.props.channel.id, modify);
						let channelIcon = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.quickswitchresulticon]]});
						if (channelIcon) this.changeChannelIconColor(channelIcon, e.instance.props.channel.id, Object.assign({alpha: 0.6}, modify));
						if (e.instance.props.category) {
							let categoryName = BDFDB.ReactUtils.findChild(e.returnvalue, {props: [["className", BDFDB.disCN.quickswitchresultnote]]});
							if (categoryName) this.changeChannelColor(categoryName, e.instance.props.category.id);
						}
					}
				}
			}
			
			processRecentsChannelHeader (e) {
				if (settings.changeInRecentMentions && BDFDB.ArrayUtils.is(e.returnvalue.props.children)) {
					for (let child of e.returnvalue.props.children) if (child && child.props && child.props.channel && child.type.displayName == "ChannelName") {
						child.props.channel = this.getChannelData(child.props.channel.id);
						let oldType = child.type;
						child.type = (...args) => {
							let instance = oldType(...args);
							let channelName = BDFDB.ReactUtils.findChild(instance, {props: [["className", BDFDB.disCN.recentmentionschannelname]]});
							if (channelName) this.changeChannelColor(channelName, child.props.channel.id);
							return instance;
						};
						child.type.displayName = oldType.displayName;
					}
				}
			}

			processMessageContent (e) {
				if (BDFDB.ArrayUtils.is(e.instance.props.content) && settings.changeInMentions) for (let ele of e.instance.props.content) {
					if (BDFDB.ReactUtils.isValidElement(ele) && ele.type && ele.type.displayName == "Tooltip" && typeof ele.props.children == "function") {
						let children = ele.props.children({});
						if (children && children.type.displayName == "Mention" && children.props.children && typeof children.props.children[0] == "string" && children.props.children[0][0] == "#") {
							let channelName = children.props.children[0].slice(1);
							let guildId = BDFDB.LibraryModules.LastGuildStore.getGuildId();
							let channels = guildId && (BDFDB.LibraryModules.GuildChannelStore.getChannels(guildId)[0] || BDFDB.LibraryModules.GuildChannelStore.getChannels(guildId).SELECTABLE);
							if (Array.isArray(channels)) for (let channelObj of channels) {
								if (channelName == channelObj.channel.name) {
									let category = BDFDB.LibraryModules.ChannelStore.getChannel(channelObj.channel.parent_id);
									if (!category || category && ele.props.text == category.name) {
										if (category) {
											let categoryData = changedChannels[category.id];
											if (categoryData && categoryData.name) ele.props.text = categoryData.name;
										}
										let name = (changedChannels[channelObj.channel.id] || {}).name;
										let color = this.getChannelDataColor(channelObj.channel.id);
										if (name || color) {
											let renderChildren = ele.props.children;
											ele.props.children = (...args) => {
												let children = renderChildren(...args);
												this.changeMention(children, {name, color});
												return children;
											}
										}
										break;
									}
								}
							}
						}
					}
				}
			}
			
			processChannelMention (e) {
				if (e.instance.props.id && settings.changeInMentions) {
					let name = (changedChannels[e.instance.props.id] || {}).name;
					let color = this.getChannelDataColor(e.instance.props.id);
					if (name || color) {
						if (typeof e.returnvalue.props.children == "function") {
							let renderChildren = e.returnvalue.props.children;
							e.returnvalue.props.children = (...args) => {
								let children = renderChildren(...args);
								this.changeMention(children, {name, color});
								return children;
							};
						}
						else this.changeMention(e.returnvalue, {name, color});
					}
				}
			}
			
			changeMention (mention, data) {
				if (data.name) {
					if (typeof mention.props.children == "string") mention.props.children = "#" + data.name;
					else if (BDFDB.ArrayUtils.is(mention.props.children)) {
						if (mention.props.children[0] == "#") mention.props.children[1] = data.name;
						else mention.props.children[0] = "#" + data.name;
					}
				}
				if (data.color) {
					let color1_0 = BDFDB.ColorUtils.convert(BDFDB.ObjectUtils.is(data.color) ? data.color[0] : data.color, "RGBA");
					let color0_1 = mention.props.mentioned ? "transparent" : BDFDB.ColorUtils.setAlpha(color1_0, 0.1, "RGBA");
					let color0_7 = mention.props.mentioned ? "transparent" : BDFDB.ColorUtils.setAlpha(color1_0, 0.7, "RGBA");
					let white = mention.props.mentioned ? color1_0 : "#FFFFFF";
					mention.props.style = Object.assign({}, mention.props.style, {
						background: color0_1,
						color: color1_0
					});
					let onMouseEnter = mention.props.onMouseEnter || ( _ => {});
					mention.props.onMouseEnter = event => {
						onMouseEnter(event);
						event.target.style.setProperty("background", color0_7, "important");
						event.target.style.setProperty("color", white, "important");
					};
					let onMouseLeave = mention.props.onMouseLeave || ( _ => {});
					mention.props.onMouseLeave = event => {
						onMouseLeave(event);
						event.target.style.setProperty("background", color0_1, "important");
						event.target.style.setProperty("color", color1_0, "important");
					};
				}
			}

			changeAppTitle () {
				let channel = BDFDB.LibraryModules.ChannelStore.getChannel(BDFDB.LibraryModules.LastChannelStore.getChannelId());
				let title = document.head.querySelector("title");
				if (title && BDFDB.ChannelUtils.isTextChannel(channel)) BDFDB.DOMUtils.setText(title, "@" + this.getChannelData(channel.id, settings.changeAppTitle).name);
			}
			
			changeChannelColor (child, channelId, modify) {
				if (BDFDB.ReactUtils.isValidElement(child)) {
					let color = this.getChannelDataColor(channelId);
					if (color) {
						color = modify ? this.chooseColor(color, modify) : BDFDB.ColorUtils.convert(color, "RGBA");
						let childProp = child.props.children ? "children" : "text";
						let fontGradient = BDFDB.ObjectUtils.is(color);
						if (fontGradient) child.props[childProp] = BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextGradientElement, {
							gradient: BDFDB.ColorUtils.createGradient(color),
							children: child.props[childProp]
						});
						else child.props[childProp] = BDFDB.ReactUtils.createElement("span", {
							style: {color: color},
							children: child.props[childProp]
						});
					}
				}
			}
			
			changeChannelIconColor (child, channelId, modify) {
				let color = this.getChannelDataColor(channelId);
				if (color && settings.changeChannelIcon) {
					color = modify ? this.chooseColor(BDFDB.ObjectUtils.is(color) ? color[0] : color, modify) : BDFDB.ColorUtils.convert(BDFDB.ObjectUtils.is(color) ? color[0] : color, "RGBA");
					child.props.color = color || "currentColor";
					if (color) child.props.foreground = null;
				}
			}

			chooseColor (color, config) {
				if (color) {
					if (BDFDB.ObjectUtils.is(config)) {
						if (config.mentions || config.focused || config.hovered || config.selected || config.unread || config.connected) color = BDFDB.ColorUtils.change(color, 0.5);
						else if (config.muted || config.locked) color = BDFDB.ColorUtils.change(color, -0.5);
					}
					return BDFDB.ColorUtils.convert(color, "RGBA");
				}
				return null;
			}
			
			getChannelDataColor (channelId) {
				let channel = BDFDB.LibraryModules.ChannelStore.getChannel(channelId);
				if (!channel) return null;
				let channelData = changedChannels[channel.id];
				if (channelData && channelData.color) return channelData.color;
				let category = channel.parent_id && BDFDB.LibraryModules.ChannelStore.getChannel(channel.parent_id);
				if (category) {
					let categoryData = changedChannels[category.id];
					if (categoryData && categoryData.inheritColor && categoryData.color) return categoryData.color;
				}
				return null;
			}
			
			getChannelData (channelId, change = true) {
				let channel = BDFDB.LibraryModules.ChannelStore.getChannel(channelId);
				if (!channel) return new BDFDB.DiscordObjects.Channel({});
				let data = change && changedChannels[channel.id];
				if (data) {
					let nativeObject = new BDFDB.DiscordObjects.Channel(channel);
					nativeObject.name = data.name || nativeObject.name;
					return nativeObject;
				}
				return new BDFDB.DiscordObjects.Channel(channel);
			}

			openChannelSettingsModal (channel) {
				let data = changedChannels[channel.id] || {};
				
				BDFDB.ModalUtils.open(this, {
					size: "MEDIUM",
					header: this.labels.modal_header,
					subheader: channel.name,
					children: [
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormComponents.FormItem, {
							title: this.labels.modal_channelname,
							className: BDFDB.disCN.marginbottom20 + " input-channelname",
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.TextInput, {
									value: data.name,
									placeholder: channel.name,
									autoFocus: true
								}),
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormComponents.FormDivider, {
									className: BDFDB.disCN.dividerdefault
								})
							]
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.FormComponents.FormItem, {
							title: this.labels.modal_colorpicker1,
							className: BDFDB.disCN.marginbottom20,
							children: [
								BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.ColorSwatches, {
									color: data.color,
									number: 1
								})
							]
						}),
						BDFDB.ReactUtils.createElement(BDFDB.LibraryComponents.SettingsItem, {
							type: "Switch",
							className: "input-inheritcolor",
							margin: 20,
							label: this.labels.modal_inheritcolor,
							tag: BDFDB.LibraryComponents.FormComponents.FormTitle.Tags.H5,
							value: channel.type == 4 && data.inheritColor,
							disabled: channel.type != 4
						})
					],
					buttons: [{
						contents: BDFDB.LanguageUtils.LanguageStrings.SAVE,
						color: "BRAND",
						close: true,
						click: modal => {
							let oldData = Object.assign({}, data);
							
							data.name = modal.querySelector(".input-channelname " + BDFDB.dotCN.input).value.trim() || null;

							data.color = BDFDB.ColorUtils.getSwatchColor(modal, 1);
							if (data.color != null && !BDFDB.ObjectUtils.is(data.color)) {
								if (data.color[0] < 30 && data.color[1] < 30 && data.color[2] < 30) data.color = BDFDB.ColorUtils.change(data.color, 30);
								else if (data.color[0] > 225 && data.color[1] > 225 && data.color[2] > 225) data.color = BDFDB.ColorUtils.change(data.color, -30);
							}

							data.inheritColor = modal.querySelector(".input-inheritcolor " + BDFDB.dotCN.switchinner).checked;
							
							let changed = false;
							if (Object.keys(data).every(key => data[key] == null || data[key] == false) && (changed = true)) BDFDB.DataUtils.remove(this, "channels", channel.id);
							else if (!BDFDB.equals(oldData, data) && (changed = true)) BDFDB.DataUtils.save(data, this, "channels", channel.id);
							if (changed) this.forceUpdateAll(true);
						}
					}]
				});
			}

			setLabelsByLanguage () {
				switch (BDFDB.LanguageUtils.getLanguage().id) {
					case "bg":		// Bulgarian
						return {
							confirm_reset:						"Наистина ли искате да нулирате този канал?",
							confirm_resetall:					"Наистина ли искате да нулирате всички канали?",
							context_localchannelsettings:		"Настройки на местния канал",
							modal_channelname:					"Име на местния канал",
							modal_colorpicker1:					"Локален цвят на канала",
							modal_header:						"Настройки на местния канал",
							modal_inheritcolor:					"Наследете цвета на подканали",
							submenu_channelsettings:			"Промяна на настройките",
							submenu_resetsettings:				"Нулиране на канала"
						};
					case "da":		// Danish
						return {
							confirm_reset:						"Er du sikker på, at du vil nulstille denne kanal?",
							confirm_resetall:					"Er du sikker på, at du vil nulstille alle kanaler?",
							context_localchannelsettings:		"Lokale kanalindstillinger",
							modal_channelname:					"Lokalt kanalnavn",
							modal_colorpicker1:					"Lokal kanalfarve",
							modal_header:						"Lokale kanalindstillinger",
							modal_inheritcolor:					"Arv farve til underkanaler",
							submenu_channelsettings:			"Ændre indstillinger",
							submenu_resetsettings:				"Nulstil kanal"
						};
					case "de":		// German
						return {
							confirm_reset:						"Möchtest du diesen Kanal wirklich zurücksetzen?",
							confirm_resetall:					"Möchtest du wirklich alle Kanäle zurücksetzen?",
							context_localchannelsettings:		"Lokale Kanaleinstellungen",
							modal_channelname:					"Lokaler Kanalname",
							modal_colorpicker1:					"Lokale Kanalfarbe",
							modal_header:						"Lokale Kanaleinstellungen",
							modal_inheritcolor:					"Vererbung der Farbe an Unterkanäle",
							submenu_channelsettings:			"Einstellungen ändern",
							submenu_resetsettings:				"Kanal zurücksetzen"
						};
					case "el":		// Greek
						return {
							confirm_reset:						"Είστε βέβαιοι ότι θέλετε να επαναφέρετε αυτό το κανάλι;",
							confirm_resetall:					"Είστε βέβαιοι ότι θέλετε να επαναφέρετε όλα τα κανάλια;",
							context_localchannelsettings:		"Ρυθμίσεις τοπικού καναλιού",
							modal_channelname:					"Τοπικό όνομα καναλιού",
							modal_colorpicker1:					"Τοπικό χρώμα καναλιού",
							modal_header:						"Ρυθμίσεις τοπικού καναλιού",
							modal_inheritcolor:					"Κληρονομήστε το χρώμα στα δευτερεύοντα κανάλια",
							submenu_channelsettings:			"Αλλαξε ρυθμίσεις",
							submenu_resetsettings:				"Επαναφορά καναλιού"
						};
					case "es":		// Spanish
						return {
							confirm_reset:						"¿Estás seguro de que deseas restablecer este canal?",
							confirm_resetall:					"¿Está seguro de que desea restablecer todos los canales?",
							context_localchannelsettings:		"Configuración de canal local",
							modal_channelname:					"Nombre del canal local",
							modal_colorpicker1:					"Color del canal local",
							modal_header:						"Configuración de canal local",
							modal_inheritcolor:					"Heredar color a subcanales",
							submenu_channelsettings:			"Cambiar ajustes",
							submenu_resetsettings:				"Restablecer canal"
						};
					case "fi":		// Finnish
						return {
							confirm_reset:						"Haluatko varmasti nollata tämän kanavan?",
							confirm_resetall:					"Haluatko varmasti nollata kaikki kanavat?",
							context_localchannelsettings:		"Paikallisen kanavan asetukset",
							modal_channelname:					"Paikallisen kanavan nimi",
							modal_colorpicker1:					"Paikallisen kanavan väri",
							modal_header:						"Paikallisen kanavan asetukset",
							modal_inheritcolor:					"Peri väri alikanaville",
							submenu_channelsettings:			"Vaihda asetuksia",
							submenu_resetsettings:				"Nollaa kanava"
						};
					case "fr":		// French
						return {
							confirm_reset:						"Voulez-vous vraiment réinitialiser cette salon?",
							confirm_resetall:					"Voulez-vous vraiment réinitialiser toutes les salons?",
							context_localchannelsettings:		"Paramètres  de la salon",
							modal_channelname:					"Nom local de la salon",
							modal_colorpicker1:					"Couleur locale de la salon",
							modal_header:						"Paramètres locaux de la salon",
							modal_inheritcolor:					"Hériter de la couleur aux sous-canaux",
							submenu_channelsettings:			"Modifier les paramètres",
							submenu_resetsettings:				"Réinitialiser la salon"
						};
					case "hr":		// Croatian
						return {
							confirm_reset:						"Jeste li sigurni da želite resetirati ovaj kanal?",
							confirm_resetall:					"Jeste li sigurni da želite resetirati sve kanale?",
							context_localchannelsettings:		"Postavke lokalnog kanala",
							modal_channelname:					"Naziv lokalnog kanala",
							modal_colorpicker1:					"Lokalna boja kanala",
							modal_header:						"Postavke lokalnog kanala",
							modal_inheritcolor:					"Naslijedi boju na podkanalima",
							submenu_channelsettings:			"Promijeniti postavke",
							submenu_resetsettings:				"Resetiraj kanal"
						};
					case "hu":		// Hungarian
						return {
							confirm_reset:						"Biztosan vissza akarja állítani ezt a csatornát?",
							confirm_resetall:					"Biztosan visszaállítja az összes csatornát?",
							context_localchannelsettings:		"Helyi csatorna beállításai",
							modal_channelname:					"Helyi csatorna neve",
							modal_colorpicker1:					"Helyi csatorna színe",
							modal_header:						"Helyi csatorna beállításai",
							modal_inheritcolor:					"Örökli a színt az alcsatornákra",
							submenu_channelsettings:			"Beállítások megváltoztatása",
							submenu_resetsettings:				"Csatorna visszaállítása"
						};
					case "it":		// Italian
						return {
							confirm_reset:						"Sei sicuro di voler ripristinare questo canale?",
							confirm_resetall:					"Sei sicuro di voler ripristinare tutti i canali?",
							context_localchannelsettings:		"Impostazioni del canale locale",
							modal_channelname:					"Nome canale locale",
							modal_colorpicker1:					"Colore canale locale",
							modal_header:						"Impostazioni del canale locale",
							modal_inheritcolor:					"Eredita colore ai canali secondari",
							submenu_channelsettings:			"Cambia impostazioni",
							submenu_resetsettings:				"Reimposta canale"
						};
					case "ja":		// Japanese
						return {
							confirm_reset:						"このチャンネルをリセットしてもよろしいですか？",
							confirm_resetall:					"すべてのチャンネルをリセットしてもよろしいですか？",
							context_localchannelsettings:		"ローカルチャンネル設定",
							modal_channelname:					"ローカルチャネル名",
							modal_colorpicker1:					"ローカルチャンネルの色",
							modal_header:						"ローカルチャンネル設定",
							modal_inheritcolor:					"サブチャネルに色を継承する",
							submenu_channelsettings:			"設定を変更する",
							submenu_resetsettings:				"チャネルをリセット"
						};
					case "ko":		// Korean
						return {
							confirm_reset:						"이 채널을 재설정 하시겠습니까?",
							confirm_resetall:					"모든 채널을 재설정 하시겠습니까?",
							context_localchannelsettings:		"로컬 채널 설정",
							modal_channelname:					"로컬 채널 이름",
							modal_colorpicker1:					"로컬 채널 색상",
							modal_header:						"로컬 채널 설정",
							modal_inheritcolor:					"하위 채널에 색상 상속",
							submenu_channelsettings:			"설정 변경",
							submenu_resetsettings:				"채널 재설정"
						};
					case "lt":		// Lithuanian
						return {
							confirm_reset:						"Ar tikrai norite iš naujo nustatyti šį kanalą?",
							confirm_resetall:					"Ar tikrai norite iš naujo nustatyti visus kanalus?",
							context_localchannelsettings:		"Vietinio kanalo nustatymai",
							modal_channelname:					"Vietinio kanalo pavadinimas",
							modal_colorpicker1:					"Vietinio kanalo spalva",
							modal_header:						"Vietinio kanalo nustatymai",
							modal_inheritcolor:					"Paveldėkite spalvas subkanalams",
							submenu_channelsettings:			"Pakeisti nustatymus",
							submenu_resetsettings:				"Iš naujo nustatyti kanalą"
						};
					case "nl":		// Dutch
						return {
							confirm_reset:						"Weet u zeker dat u dit kanaal opnieuw wilt instellen?",
							confirm_resetall:					"Weet u zeker dat u alle kanalen opnieuw wilt instellen?",
							context_localchannelsettings:		"Lokale kanaalinstellingen",
							modal_channelname:					"Lokale kanaalnaam",
							modal_colorpicker1:					"Lokale kanaalkleur",
							modal_header:						"Lokale kanaalinstellingen",
							modal_inheritcolor:					"Overerf kleur naar subkanalen",
							submenu_channelsettings:			"Instellingen veranderen",
							submenu_resetsettings:				"Kanaal resetten"
						};
					case "no":		// Norwegian
						return {
							confirm_reset:						"Er du sikker på at du vil tilbakestille denne kanalen?",
							confirm_resetall:					"Er du sikker på at du vil tilbakestille alle kanaler?",
							context_localchannelsettings:		"Lokale kanalinnstillinger",
							modal_channelname:					"Lokalt kanalnavn",
							modal_colorpicker1:					"Lokal kanalfarge",
							modal_header:						"Lokale kanalinnstillinger",
							modal_inheritcolor:					"Arv farge til underkanaler",
							submenu_channelsettings:			"Endre innstillinger",
							submenu_resetsettings:				"Tilbakestill kanal"
						};
					case "pl":		// Polish
						return {
							confirm_reset:						"Czy na pewno chcesz zresetować ten kanał?",
							confirm_resetall:					"Czy na pewno chcesz zresetować wszystkie kanały?",
							context_localchannelsettings:		"Ustawienia kanału lokalnego",
							modal_channelname:					"Nazwa kanału lokalnego",
							modal_colorpicker1:					"Kolor kanału lokalnego",
							modal_header:						"Ustawienia kanału lokalnego",
							modal_inheritcolor:					"Dziedzicz kolor do kanałów podrzędnych",
							submenu_channelsettings:			"Zmień ustawienia",
							submenu_resetsettings:				"Resetuj kanał"
						};
					case "pt-BR":	// Portuguese (Brazil)
						return {
							confirm_reset:						"Tem certeza que deseja redefinir este canal?",
							confirm_resetall:					"Tem certeza de que deseja redefinir todos os canais?",
							context_localchannelsettings:		"Configurações de canal local",
							modal_channelname:					"Nome do canal local",
							modal_colorpicker1:					"Cor do Canal Local",
							modal_header:						"Configurações de canal local",
							modal_inheritcolor:					"Herdar cor para subcanais",
							submenu_channelsettings:			"Mudar configurações",
							submenu_resetsettings:				"Reiniciar canal"
						};
					case "ro":		// Romanian
						return {
							confirm_reset:						"Sigur doriți să resetați acest canal?",
							confirm_resetall:					"Sigur doriți să resetați toate canalele?",
							context_localchannelsettings:		"Setări canale locale",
							modal_channelname:					"Numele canalului local",
							modal_colorpicker1:					"Culoare canal local",
							modal_header:						"Setări canale locale",
							modal_inheritcolor:					"Moșteniți culoarea la sub-canale",
							submenu_channelsettings:			"Schimbă setările",
							submenu_resetsettings:				"Resetați canalul"
						};
					case "ru":		// Russian
						return {
							confirm_reset:						"Вы уверены, что хотите сбросить этот канал?",
							confirm_resetall:					"Вы уверены, что хотите сбросить все каналы?",
							context_localchannelsettings:		"Настройки локального канала",
							modal_channelname:					"Имя локального канала",
							modal_colorpicker1:					"Цвет локального канала",
							modal_header:						"Настройки локального канала",
							modal_inheritcolor:					"Наследовать цвет для субканалов",
							submenu_channelsettings:			"Изменить настройки",
							submenu_resetsettings:				"Сбросить канал"
						};
					case "sv":		// Swedish
						return {
							confirm_reset:						"Är du säker på att du vill återställa den här kanalen?",
							confirm_resetall:					"Är du säker på att du vill återställa alla kanaler?",
							context_localchannelsettings:		"Lokala kanalinställningar",
							modal_channelname:					"Lokalt kanalnamn",
							modal_colorpicker1:					"Lokal kanalfärg",
							modal_header:						"Lokala kanalinställningar",
							modal_inheritcolor:					"Ärva färg till underkanaler",
							submenu_channelsettings:			"Ändra inställningar",
							submenu_resetsettings:				"Återställ kanal"
						};
					case "th":		// Thai
						return {
							confirm_reset:						"แน่ใจไหมว่าต้องการรีเซ็ตช่องนี้",
							confirm_resetall:					"แน่ใจไหมว่าต้องการรีเซ็ตช่องทั้งหมด",
							context_localchannelsettings:		"การตั้งค่าช่องท้องถิ่น",
							modal_channelname:					"ชื่อช่องท้องถิ่น",
							modal_colorpicker1:					"ช่องท้องถิ่นสี",
							modal_header:						"การตั้งค่าช่องท้องถิ่น",
							modal_inheritcolor:					"สืบทอดสีไปยังช่องย่อย",
							submenu_channelsettings:			"เปลี่ยนการตั้งค่า",
							submenu_resetsettings:				"รีเซ็ตช่อง"
						};
					case "tr":		// Turkish
						return {
							confirm_reset:						"Bu kanalı sıfırlamak istediğinizden emin misiniz?",
							confirm_resetall:					"Tüm kanalları sıfırlamak istediğinizden emin misiniz?",
							context_localchannelsettings:		"Yerel Kanal Ayarları",
							modal_channelname:					"Yerel Kanal Adı",
							modal_colorpicker1:					"Yerel Kanal Rengi",
							modal_header:						"Yerel Kanal Ayarları",
							modal_inheritcolor:					"Renkleri Alt Kanallara Devral",
							submenu_channelsettings:			"Ayarları değiştir",
							submenu_resetsettings:				"Kanalı Sıfırla"
						};
					case "uk":		// Ukrainian
						return {
							confirm_reset:						"Справді скинути цей канал?",
							confirm_resetall:					"Ви впевнені, що хочете скинути всі канали?",
							context_localchannelsettings:		"Налаштування локального каналу",
							modal_channelname:					"Назва місцевого каналу",
							modal_colorpicker1:					"Колір локального каналу",
							modal_header:						"Налаштування локального каналу",
							modal_inheritcolor:					"Успадковувати колір для підканалів",
							submenu_channelsettings:			"Змінити налаштування",
							submenu_resetsettings:				"Скинути канал"
						};
					case "vi":		// Vietnamese
						return {
							confirm_reset:						"Bạn có chắc chắn muốn đặt lại kênh này không?",
							confirm_resetall:					"Bạn có chắc chắn muốn đặt lại tất cả các kênh không?",
							context_localchannelsettings:		"Cài đặt kênh cục bộ",
							modal_channelname:					"Tên kênh địa phương",
							modal_colorpicker1:					"Màu kênh địa phương",
							modal_header:						"Cài đặt kênh cục bộ",
							modal_inheritcolor:					"Kế thừa màu cho các kênh phụ",
							submenu_channelsettings:			"Thay đổi cài đặt",
							submenu_resetsettings:				"Đặt lại kênh"
						};
					case "zh":		// Chinese
						return {
							confirm_reset:						"您确定要重置此频道吗？",
							confirm_resetall:					"您确定要重置所有频道吗？",
							context_localchannelsettings:		"本地频道设置",
							modal_channelname:					"本地频道名称",
							modal_colorpicker1:					"本地频道颜色",
							modal_header:						"本地频道设置",
							modal_inheritcolor:					"继承颜色到子通道",
							submenu_channelsettings:			"更改设置",
							submenu_resetsettings:				"重置频道"
						};
					case "zh-TW":	// Chinese (Traditional)
						return {
							confirm_reset:						"您確定要重置此頻道嗎？",
							confirm_resetall:					"您確定要重置所有頻道嗎？",
							context_localchannelsettings:		"本地頻道設置",
							modal_channelname:					"本地頻道名稱",
							modal_colorpicker1:					"本地頻道顏色",
							modal_header:						"本地頻道設置",
							modal_inheritcolor:					"繼承顏色到子通道",
							submenu_channelsettings:			"更改設置",
							submenu_resetsettings:				"重置頻道"
						};
					default:		// English
						return {
							confirm_reset:						"Are you sure you want to reset this Channel?",
							confirm_resetall:					"Are you sure you want to reset all Channels?",
							context_localchannelsettings:		"Local Channel Settings",
							modal_channelname:					"Local Channel Name",
							modal_colorpicker1:					"Local Channel Color",
							modal_header:						"Local Channel Settings",
							modal_inheritcolor:					"Inherit Color to Sub-Channels",
							submenu_channelsettings:			"Change Settings",
							submenu_resetsettings:				"Reset Channel"
						};
				}
			}
		};
	})(window.BDFDB_Global.PluginUtils.buildPlugin(config));
})();
