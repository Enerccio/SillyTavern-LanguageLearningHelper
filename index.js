import {
    TAG_ANCHOR,
    TAG_BLOCK, TAG_COACH,
    TAG_EXPLANATION, TAG_NOTES,
    TAG_TRANSLATION
} from "./conf.js";
import {formatting_stage, hook_order, MessageFormatter} from "/scripts/message-formatter.js";
import {cleanHistoryForLLM, compilePromptTemplate, processCoachTags, processInputStream} from "./utils.js";
import {event_types, eventSource} from "/scripts/events.js";
import {COACH_PROMPT, DEFAULT_PROMPT} from "./constants.js";
import {
    getActiveConfiguration,
    wireSettings
} from "./settings.js";

const unblurredCoaches = new Set();
const hoveredCoaches = new Set();
const clickedCoaches = new Set();

class EnerccioLlhNotes extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        // Move the original nested HTML nodes into a native collapsible container
        const originalContent = this.innerHTML;
        this.innerHTML = `
            <details>
                <summary>Translation & Grammar Notes</summary>
                <div class="llh-notes-content">
                    ${originalContent}
                </div>
            </details>
        `;

        const summaryElement = this.querySelector('summary');
        if (summaryElement) {
            summaryElement.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents the accordion from instantly snapping shut on manual clicks
            });
        }
    }
}

class EnerccioLlhBlock extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const returnTrigger = this.querySelector('[data-llh-trigger]');

        if (returnTrigger) {
            returnTrigger.style.cursor = 'pointer';
            returnTrigger.style.color = '#4a90e2';
            returnTrigger.style.fontWeight = 'bold';
            returnTrigger.style.marginRight = '6px';

            returnTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();

                const fnNumber = returnTrigger.getAttribute('data-fn');
                const messageBubble = this.closest('.mes_text');
                if (!messageBubble) return;

                // UPGRADE: Find the precise inline anchor located inside this active message bubble context
                const inlineAnchor = messageBubble.querySelector(`[data-llh-id="inline-${fnNumber}"]`);
                if (inlineAnchor) {
                    inlineAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });

                    const originalColor = inlineAnchor.style.color;
                    inlineAnchor.style.color = '#ff9800';
                    setTimeout(() => {
                        inlineAnchor.style.color = originalColor;
                    }, 1000);
                }
            });
        }
    }
}


class EnerccioLlhTranslation extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.addEventListener('click', () => {
            this.classList.toggle('unblurred');
        });
    }
}

class EnerccioLlhExplanation extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.addEventListener('click', () => {
            this.classList.toggle('unblurred');
        });
    }
}

class EnerccioLlhAnchor extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        this.style.cursor = 'pointer';
        this.style.color = '#4a90e2';
        this.style.fontWeight = 'bold';
        this.style.margin = '0 2px';

        this.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const fnNumber = this.getAttribute('data-fn');
            const messageBubble = this.closest('.mes_text');
            if (!messageBubble) return;

            const detailsElement = messageBubble.querySelector('enerccio-llh-notes details');
            if (detailsElement) {
                detailsElement.open = true;
            }

            // FIX: Swap from old '#llh-note-card-...' to the robust data attribute selector
            const targetCard = messageBubble.querySelector(`[data-llh-id="card-${fnNumber}"]`);

            if (targetCard) {
                // Smoothly scroll down to focus on the footer card row
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Fire your external pulse highlight layout glow
                targetCard.classList.add('llh-pulse-highlight');
                setTimeout(() => {
                    targetCard.classList.remove('llh-pulse-highlight');
                }, 1500);
            }
        });
    }
}

class EnerccioLlhCoach extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const messageElement = this.closest('.mes');
        const messageId = messageElement ? messageElement.getAttribute('mesid') : null;

        if (messageId && (unblurredCoaches.has(messageId) || hoveredCoaches.has(messageId))) {
            this.classList.add('unblurred');
        }

        this.addEventListener('click', () => {
            const currentMessageElement = this.closest('.mes');
            const currentMessageId = currentMessageElement ? currentMessageElement.getAttribute('mesid') : null;

            this.classList.toggle('unblurred');

            if (currentMessageId) {
                if (clickedCoaches.has(currentMessageId)) {
                    // Disable clicked state -> restore hover logic
                    clickedCoaches.delete(currentMessageId);
                } else {
                    // Enable clicked state -> reset and ignore hover logic
                    clickedCoaches.add(currentMessageId);
                    hoveredCoaches.delete(currentMessageId);
                }

                if (this.classList.contains('unblurred')) {
                    unblurredCoaches.add(currentMessageId);
                } else {
                    unblurredCoaches.delete(currentMessageId);
                }
            }
        });

        this.addEventListener('mouseenter', () => {
            const currentMessageElement = this.closest('.mes');
            const currentMessageId = currentMessageElement ? currentMessageElement.getAttribute('mesid') : null;
            if (currentMessageId) {
                if (clickedCoaches.has(currentMessageId)) return;
                hoveredCoaches.add(currentMessageId);
                this.classList.add('unblurred');
            }
        });

        this.addEventListener('mouseleave', () => {
            const currentMessageElement = this.closest('.mes');
            const currentMessageId = currentMessageElement ? currentMessageElement.getAttribute('mesid') : null;
            if (currentMessageId) {
                if (clickedCoaches.has(currentMessageId)) return;
                hoveredCoaches.delete(currentMessageId);
                if (!unblurredCoaches.has(currentMessageId)) {
                    this.classList.remove('unblurred');
                }
            }
        });
    }
}

async function processPrompt(data) {
    const activeConfig = getActiveConfiguration();

    // IF PROFILE COMPONENT IS DISABLED -> Skip prompt rules injection entirely!
    if (activeConfig.isProfileEnabled === false) {
        data.chat = cleanHistoryForLLM(data.chat); // Keep purging history to strip old structural artifacts
        return;
    }

    data.chat = cleanHistoryForLLM(data.chat);
    const sourcePromptMatrixText = activeConfig.customPromptOverride || DEFAULT_PROMPT;
    const llhRuleBlock = compilePromptTemplate(sourcePromptMatrixText, {
        "language": activeConfig.targetLanguage || "Japanese",
        "sourceLanguage": activeConfig.sourceLanguage || "English",
        "grammarLanguage": activeConfig.grammarLanguage || "English"
    });

    for (let i = data.chat.length - 1; i >= 0; i--) {
        if (data.chat[i].role === 'user') {
            if (activeConfig.isCoachModeEnabled) {
                const compiledCoach = compilePromptTemplate(activeConfig.coachPromptOverride || COACH_PROMPT, {
                    "sourceLanguage": activeConfig.sourceLanguage || "English",
                    "userPrompt": data.chat[i].content
                });
                data.chat[i].content = `${compiledCoach}\n\n${llhRuleBlock}`;
            } else {
                data.chat[i].content += `\n\n[SYSTEM INSTRUCTION: ${llhRuleBlock}]`;
            }
            return;
        }
    }
}

function cleanSingleMessage(textData, chatMessage, context = {}) {
    if (chatMessage) {
        let m = [{
            role: chatMessage.role,
            content: textData
        }];
        m = cleanHistoryForLLM(m)[0];
        return [m.content, true];
    }
    return [textData, true];
}

function cleanBulkText(textData, context = {}) {
    if (textData) {
        let m = [{
            role: 'assistant',
            content: textData
        }];
        m = cleanHistoryForLLM(m)[0];
        return [m.content, true];
    }
    return [textData, true];
}

$(async function () {
    if (typeof MessageFormatter === 'undefined') {
        console.error(`[LLH] Extension failed to load: This plugin requires the SillyTavern Staging branch to access the modern MessageFormatter pipeline.`);
        return; // Safely abort loading without throwing uncaught execution crashes
    }

    if (typeof DOMPurify !== 'undefined') {
        DOMPurify.addHook('uponSanitizeElement', (node, data) => {
            // Check if the current element matches any of your extension tags
            const tagName = node.tagName ? node.tagName.toLowerCase() : '';
            if (tagName === `${TAG_COACH}` || tagName === `${TAG_ANCHOR}` || tagName === `${TAG_NOTES}` || tagName === `${TAG_BLOCK}` || tagName === `${TAG_TRANSLATION}` || tagName === `${TAG_EXPLANATION}`) {
                // Force DOMPurify to whitelist this specific node and keep its elements intact
                data.allowedTags[tagName] = true;
            }
        });
    }
    if (!customElements.get(`${TAG_COACH}`)) {
        customElements.define(`${TAG_COACH}`, EnerccioLlhCoach);
    }
    if (!customElements.get(`${TAG_NOTES}`)) {
        customElements.define(`${TAG_NOTES}`, EnerccioLlhNotes);
    }
    if (!customElements.get(`${TAG_BLOCK}`)) {
        customElements.define(`${TAG_BLOCK}`, EnerccioLlhBlock);
    }
    if (!customElements.get(`${TAG_TRANSLATION}`)) {
        customElements.define(`${TAG_TRANSLATION}`, EnerccioLlhTranslation);
    }
    if (!customElements.get(`${TAG_EXPLANATION}`)) {
        customElements.define(`${TAG_EXPLANATION}`, EnerccioLlhExplanation)
    }
    if (!customElements.get(`${TAG_ANCHOR}`)) {
        customElements.define(`${TAG_ANCHOR}`, EnerccioLlhAnchor);
    }

    await wireSettings();

    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, async (data) => {
        await processPrompt(data);
    });

    eventSource.on(event_types.CHAT_CHANGED, () => {
        unblurredCoaches.clear();
        hoveredCoaches.clear();
        clickedCoaches.clear();
    });

    eventSource.on(event_types.CHAT_LOADED, () => {
        unblurredCoaches.clear();
        hoveredCoaches.clear();
        clickedCoaches.clear();
    });

    MessageFormatter.addHook(processInputStream, {
        stage: formatting_stage.BEFORE_REGEX,
        order: hook_order.EARLIEST
    });
    MessageFormatter.addHook(processCoachTags, {
        stage: formatting_stage.AFTER_MARKDOWN,
        order: hook_order.EARLIEST
    });

    window.enerccio_compat?.messageProcessor.registerHandler(cleanSingleMessage);
    window.enerccio_compat?.textProcessor.registerHandler(cleanBulkText);
});
