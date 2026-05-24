import {DEFAULT_PROMPT, DEFAULT_SETTINGS} from "./constants.js";
import {callGenericPopup, POPUP_TYPE} from "/scripts/popup.js";
import {event_types, eventSource} from "/scripts/events.js";
import {toastDebounced} from "./utils.js";
import {EXTENSION_NAME, EXTENSION_PATH, MODULE_NAME, VERSION} from "./conf.js";
import {extension_settings, renderExtensionTemplateAsync} from "/scripts/extensions.js";
import {saveSettingsDebounced} from "/script.js";

const $ = jQuery;
let lastResolvedProfileName = "";

// ==========================================
// CORE PERSISTENCE GETTERS/SETTERS
// ==========================================
export function getSettings(key, def) {
    const ctx = SillyTavern.getContext();
    if (!ctx.extensionSettings[MODULE_NAME]) ctx.extensionSettings[MODULE_NAME] = {};
    return ctx.extensionSettings[MODULE_NAME][key] ?? def;
}

export function setSettings(key, val) {
    const ctx = SillyTavern.getContext();
    if (!ctx.extensionSettings[MODULE_NAME]) ctx.extensionSettings[MODULE_NAME] = {};
    ctx.extensionSettings[MODULE_NAME][key] = val;
    saveSettingsDebounced();
}

// ==========================================
// PROFILE AND BINDING RESOLUTION CONTEXTS
// ==========================================
export function resolveProfileContextName() {
    const context = SillyTavern.getContext();
    const chatBinds = getSettings("chatBinds", {});
    const characterBinds = getSettings("characterBinds", {});

    if (context.chatId && chatBinds[context.chatId]) return chatBinds[context.chatId];

    if (context.characterId !== null && context.characterId !== undefined && context.characterId >= 0) {
        const char = context.characters[context.characterId];
        if (char?.avatar && characterBinds[char.avatar]) return characterBinds[char.avatar];
    }

    return getSettings("activeGlobalProfile", "Default");
}

export function getActiveConfiguration() {
    const activeProfileName = resolveProfileContextName();
    const profiles = getSettings("profiles", {});

    return profiles[activeProfileName] || {
        isProfileEnabled: true,
        targetLanguage: "Japanese",
        sourceLanguage: "English",
        grammarLanguage: "English",
        customPromptOverride: ""
    };
}

// ==========================================
// NOTIFICATION INTERFACES
// ==========================================
function runContextTrackObserver() {
    if (!getSettings("showContextToasts", true)) return;

    const activeProfile = resolveProfileContextName();
    if (lastResolvedProfileName && lastResolvedProfileName !== activeProfile) {
        toastDebounced(`Language Helper switched profile mapping to: [ ${activeProfile} ]`, "info");
    }
    lastResolvedProfileName = activeProfile;
    syncAndRenderSettingsUI(); // Ensure UI dropdown shifts if character binds forced it
    updateGlobalBlurModeClass();
}

// ==========================================
// POPUP DIALOG TEXT MATRIX WORKSPACE
// ==========================================
function openPromptTemplatePopupEditor() {
    const profiles = getSettings("profiles", {});
    const activeProfile = getSettings("activeGlobalProfile", "Default");
    const currentConfig = profiles[activeProfile] || {};

    const currentCustomText = currentConfig.customPromptOverride || "";
    const initialTextValue = currentCustomText || DEFAULT_PROMPT;

    const modalHtml = `
        <div style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
            <p>Modify the core background instructions for profile: <b>[ ${activeProfile} ]</b>.</p>
            <textarea id="llh-modal-prompt-textarea" class="text_pole" style="height: 350px; font-family: monospace; width: 100%; resize: vertical;">${initialTextValue}</textarea>
            <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                <button id="llh-modal-reset-btn" class="menu_button btn-secondary">Restore Baseline Default</button>
            </div>
        </div>
    `;

    callGenericPopup(modalHtml, POPUP_TYPE.CONFIRM, "", {
        okButton: "Save to Profile",
        cancelButton: "Cancel"
    }).then((isConfirmed) => {
        if (!isConfirmed) return;

        const textValue = $('#llh-modal-prompt-textarea').val()?.trim() || "";

        if (profiles[activeProfile]) {
            if (textValue === DEFAULT_PROMPT || !textValue) {
                profiles[activeProfile].customPromptOverride = "";
            } else {
                profiles[activeProfile].customPromptOverride = textValue;
            }
            setSettings("profiles", profiles);
            toastDebounced(`System prompt updated for profile: [ ${activeProfile} ]`);
        }
    });

    $(document).off('click', '#llh-modal-reset-btn').on('click', '#llh-modal-reset-btn', () => {
        $('#llh-modal-prompt-textarea').val(DEFAULT_PROMPT);
    });
}

// ==========================================
// UI SYNCHRONIZATION AND RENDER MANAGEMENT
// ==========================================
function syncAndRenderSettingsUI() {
    const profiles = getSettings("profiles", {"Default": {}});
    const globalActive = getSettings("activeGlobalProfile", "Default");
    const showToasts = getSettings("showContextToasts", true);

    const dropdown = $('#llh-profile-selector');
    if (dropdown.length === 0) return; // Prevent executing before DOM injections land

    dropdown.empty();
    Object.keys(profiles).forEach(pName => {
        dropdown.append(`<option value="${pName}" ${pName === globalActive ? 'selected' : ''}>${pName}</option>`);
    });

    const activeConfig = profiles[globalActive] || {};
    const isEnabled = activeConfig.isProfileEnabled ?? true;

    $('#llh-profile-enabled').prop('checked', isEnabled);
    $('#llh-profile-no-blur').prop('checked', activeConfig.isBlurDisabled ?? false);
    $('#llh-target-lang').val(activeConfig.targetLanguage || "Japanese");
    $('#llh-source-lang').val(activeConfig.sourceLanguage || "English");
    $('#llh-grammar-lang').val(activeConfig.grammarLanguage || "English");
    $('#llh-toggle-toasts').prop('checked', showToasts);

    // Dynamic UI enhancement: Gray out text fields if the configuration block is disabled
    const fields = $('#llh-target-lang, #llh-source-lang, #llh-grammar-lang, #llh-edit-prompt-btn');
    if (isEnabled) {
        fields.prop('disabled', false).css('opacity', '1');
    } else {
        fields.prop('disabled', true).css('opacity', '0.5');
    }
}

function saveActiveInputFields() {
    const profiles = getSettings("profiles", {});
    const activeProfile = getSettings("activeGlobalProfile", "Default");

    if (profiles[activeProfile]) {
        profiles[activeProfile] = {
            isProfileEnabled: $('#llh-profile-enabled').is(':checked'),
            isBlurDisabled: $('#llh-profile-no-blur').is(':checked'),
            targetLanguage: $('#llh-target-lang').val()?.trim() || "Japanese",
            sourceLanguage: $('#llh-source-lang').val()?.trim() || "English",
            grammarLanguage: $('#llh-grammar-lang').val()?.trim() || "English",
            customPromptOverride:
                profiles[activeProfile].customPromptOverride || ""
        }
        ;
        setSettings("profiles", profiles);
    }
}

export function updateGlobalBlurModeClass() {
    const config = getActiveConfiguration();
    const chatContainer = $('#chat');

    if (chatContainer.length === 0) return;

    if (config.isProfileEnabled && config.isBlurDisabled) {
        chatContainer.addClass('llh-no-blur-mode');
    } else {
        chatContainer.removeClass('llh-no-blur-mode');
    }
}

function updateBindingStatusDisplay() {
    const context = SillyTavern.getContext();
    const activeGlobal = getSettings("activeGlobalProfile", "Default");
    const characterBinds = getSettings("characterBinds", {});
    const chatBinds = getSettings("chatBinds", {});

    let statusMsg = "Inheriting system-wide Global profile selection.";
    let charBoundName = "";
    let chatBoundName = "";

    // Check live context states
    if (context.characterId !== null && context.characterId !== undefined && context.characterId >= 0) {
        const char = context.characters[context.characterId];
        if (char?.avatar && characterBinds[char.avatar]) {
            charBoundName = characterBinds[char.avatar];
            statusMsg = `Locked onto Character Override profile: [ ${charBoundName} ]`;
        }
    }

    if (context.chatId && chatBinds[context.chatId]) {
        chatBoundName = chatBinds[context.chatId];
        statusMsg = `Locked onto active Chat Log Override profile: [ ${chatBoundName} ]`;
    }

    $('#llh-bind-status-text').text(statusMsg);

    // Style the button accents to show active/toggled state colors natively
    if (charBoundName) $('#llh-bind-char-btn').addClass('menu_button_selected').attr('title', `Unbind profile from this character (Currently: ${charBoundName})`);
    else $('#llh-bind-char-btn').removeClass('menu_button_selected').attr('title', 'Force this specific character to always load the active profile');

    if (chatBoundName) $('#llh-bind-chat-btn').addClass('menu_button_selected').attr('title', `Unbind profile from this specific conversation log (Currently: ${chatBoundName})`);
    else $('#llh-bind-chat-btn').removeClass('menu_button_selected').attr('title', 'Force this specific chat history thread to always load the active profile');
}

// ==========================================
// INTERFACE BOILERPLATE INJECTION REGISTRY
// ==========================================
export async function wireSettings() {

    const settingsHtmlFragment = await renderExtensionTemplateAsync(
        EXTENSION_PATH,
        'settings',
        { title: EXTENSION_NAME, version: VERSION }
    );
    // noinspection JSCheckFunctionSignatures
    $('#extensions_settings2').append(settingsHtmlFragment);

    loadModuleSettingsDatabase();
    syncAndRenderSettingsUI();
    lastResolvedProfileName = resolveProfileContextName();

    $('#llh-bind-char-btn').off('click').on('click', (e) => {
        e.stopPropagation();
        const context = SillyTavern.getContext();
        if (context.characterId === null || context.characterId === undefined || context.characterId < 0) {
            return toastr.warning("No active character card detected to apply bindings onto.");
        }

        const char = context.characters[context.characterId];
        if (!char?.avatar) return;

        const activeProfile = getSettings("activeGlobalProfile", "Default");
        const characterBinds = getSettings("characterBinds", {});

        // Toggle Action: If already bound to this active profile, remove the lock to clear settings
        if (characterBinds[char.avatar] === activeProfile) {
            delete characterBinds[char.avatar];
            toastr.success(`Cleared character override lock for ${char.name}.`);
        } else {
            characterBinds[char.avatar] = activeProfile;
            toastr.success(`Profile [ ${activeProfile} ] permanently bound onto character: ${char.name}`);
        }

        setSettings("characterBinds", characterBinds);
        updateBindingStatusDisplay();
        updateGlobalBlurModeClass();
    });

    // NEW: Chat Log Binding Button Handler
    $('#llh-bind-chat-btn').off('click').on('click', (e) => {
        e.stopPropagation();
        const context = SillyTavern.getContext();
        if (!context.chatId) {
            return toastr.warning("No active conversation session string found to anchor file bindings onto.");
        }

        const activeProfile = getSettings("activeGlobalProfile", "Default");
        const chatBinds = getSettings("chatBinds", {});

        // Toggle Action: If already bound to this active profile, remove the lock to clear settings
        if (chatBinds[context.chatId] === activeProfile) {
            delete chatBinds[context.chatId];
            toastr.success("Cleared dynamic conversation file override lock.");
        } else {
            chatBinds[context.chatId] = activeProfile;
            toastr.success(`Profile [ ${activeProfile} ] permanently bound onto this specific chat log.`);
        }

        setSettings("chatBinds", chatBinds);
        updateBindingStatusDisplay();
        updateGlobalBlurModeClass();
    });

    // Event Bindings Mapping
    $('#llh-profile-selector').on('change', function () {
        setSettings("activeGlobalProfile", $(this).val());
        syncAndRenderSettingsUI();
        runContextTrackObserver();
    });

    $('#llh-profile-enabled').on('change', () => {
        saveActiveInputFields();
        syncAndRenderSettingsUI(); // Refresh opacities on toggle state changes
    });

    $('#llh-target-lang, #llh-source-lang, #llh-grammar-lang').on('input blur', () => {
        saveActiveInputFields();
    });

    $('#llh-toggle-toasts').on('change', function () {
        setSettings("showContextToasts", $(this).is(':checked'));
    });

    $('#llh-edit-prompt-btn').on('click', (e) => {
        e.stopPropagation();
        openPromptTemplatePopupEditor();
    });

    $('#llh-profile-no-blur').on('change', () => {
        saveActiveInputFields();
        updateGlobalBlurModeClass(); // We will create this helper function right below!
    });

    $('#llh-save-profile-as-btn').on('click', (e) => {
        e.stopPropagation();
        const activeName = getSettings("activeGlobalProfile", "Default");
        const customName = prompt("Enter custom unique profile configuration name:", `${activeName} Copy`);
        if (!customName?.trim()) return;

        const profiles = getSettings("profiles", {});
        if (profiles[customName.trim()]) return alert("Profile name is already taken!");

        profiles[customName.trim()] = structuredClone(profiles[activeName]);
        setSettings("profiles", profiles);
        setSettings("activeGlobalProfile", customName.trim());
        syncAndRenderSettingsUI();
        runContextTrackObserver();
    });

    $('#llh-delete-profile-btn').on('click', (e) => {
        e.stopPropagation();
        const activeName = getSettings("activeGlobalProfile", "Default");
        if (activeName === "Default") return alert("The baseline fallback 'Default' profile cannot be deleted.");

        if (confirm(`Are you absolutely sure you want to completely purge profile: [ ${activeName} ]?`)) {
            const profiles = getSettings("profiles", {});
            delete profiles[activeName];
            setSettings("profiles", profiles);
            setSettings("activeGlobalProfile", "Default");
            syncAndRenderSettingsUI();
            runContextTrackObserver();
        }
    });

    // Automate session tracking hooks shifts (Update to refresh display bindings contextually)
    eventSource.on(event_types.CHAT_CHANGED, () => {
        runContextTrackObserver();
        updateBindingStatusDisplay();
    });
    eventSource.on(event_types.CHAT_LOADED, () => {
        runContextTrackObserver();
        updateBindingStatusDisplay();
    });
}

function loadModuleSettingsDatabase() {
    const ctx = SillyTavern.getContext();

    if (!ctx.extensionSettings[MODULE_NAME]) {
        ctx.extensionSettings[MODULE_NAME] = {};
    }

    const userSettings = ctx.extensionSettings[MODULE_NAME];

    Object.keys(DEFAULT_SETTINGS).forEach(key => {
        if (userSettings[key] === undefined) {
            userSettings[key] = structuredClone(DEFAULT_SETTINGS[key]);
        }
    });

    if (DEFAULT_SETTINGS.profiles && userSettings.profiles) {
        Object.keys(DEFAULT_SETTINGS.profiles).forEach(profName => {
            if (userSettings.profiles[profName] === undefined) {
                userSettings.profiles[profName] = structuredClone(DEFAULT_SETTINGS.profiles[profName]);
            }
        });
    }
}
