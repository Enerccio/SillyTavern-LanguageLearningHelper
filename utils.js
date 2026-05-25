import {EXTENSION_NAME, TAG_ANCHOR, TAG_BLOCK, TAG_EXPLANATION, TAG_NOTES, TAG_TRANSLATION} from './conf.js';
import {debounce} from "/scripts/utils.js";

export function log() {
    console.log(`[${EXTENSION_NAME}]`, ...arguments);
}

export function toast(message, type="info") {
    // debounce the toast messages
    // noinspection JSUnresolvedReference
    toastr[type](message, EXTENSION_NAME);
}

export const toastDebounced = debounce(toast, 500);

export function cleanHistoryForLLM(messages) {
    const appendixRegex = /\[TRANSLATION_NOTES\][\s\S]*?\[\/TRANSLATION_NOTES\]/gi;

    const inlineAnchorRegex = /\[LLH_FN_[a-z0-9_-]+\]/gi;

    return messages.map(msg => {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
            let cleanContent = msg.content
                .replace(appendixRegex, '')
                .replace(inlineAnchorRegex, '') // Removes the inline link tags entirely
                .trim();

            return { ...msg, content: cleanContent };
        }
        return msg;
    });
}


let llhmAnimationFrameCounter = 0;
export function processInputStream(data, ctx) {
    if (typeof data !== 'string') return data;
    if (ctx.isReasoning) return data;

    let removedAggressively = false;
    let cleanStreamData = data;

    // STEP 1: Lookahead scanner checking for trailing unclosed stream tokens at the edge ($)
    const safeLookaheadRegex = /(?:\[TRANSLATION_NOTES\](?![\s\S]*?\[\/TRANSLATION_NOTES\])[\s\S]*|\[BLOCK\](?![\s\S]*?\[\/BLOCK\])[\s\S]*)$/i;

    if (safeLookaheadRegex.test(data)) {
        cleanStreamData = data.replace(safeLookaheadRegex, '');
        removedAggressively = true;
    }

    // STEP 2: Pure HTML token compiler
    let normalizedData = cleanStreamData
        // FIX: Moved this rule to POSITION #1 so it intercepts [BLOCK][LLH_FN_1] before HTML expansion takes place!
        .replace(/\[BLOCK\]\s*\[([a-z0-9_-]+)\]/gi, (match, fnIdentifier) => {
            const cleanNumber = fnIdentifier.replace(/LLH_FN_/gi, '').trim();
            return `<${TAG_BLOCK} data-llh-id="card-${cleanNumber}"><span data-llh-trigger data-fn="${cleanNumber}">[${cleanNumber}]</span>`;
        })

        // Standard structural tag wrapper expansions
        .replace(/\[TRANSLATION_NOTES\]/g, `<${TAG_NOTES}>`)
        .replace(/\[\/TRANSLATION_NOTES\]/g, `</${TAG_NOTES}>`)
        .replace(/\[\/BLOCK\]/g, `</${TAG_BLOCK}>`)
        .replace(/\[TRANSLATION\]/g, `<${TAG_TRANSLATION}>`)
        .replace(/\[\/TRANSLATION\]/g, `</${TAG_TRANSLATION}>`)
        .replace(/\[EXPLANATION\]/g, `<${TAG_EXPLANATION}>`)
        .replace(/\[\/EXPLANATION\]/g, `</${TAG_EXPLANATION}>`)

        // Inline hyperlink parser runs smoothly now that the block prefix has been cleaned up
        .replace(/\[LLH_FN_(\d+)\]/g, `<${TAG_ANCHOR} data-fn="$1" data-llh-id="inline-$1">[$1]</${TAG_ANCHOR}>`);

    // STEP 3: Handle real-time animation loading states
    if (removedAggressively) {
        const frames = [
            ".", "..", "...",
            "...P", "...Pr", "...Pro", "...Proc", "...Proce", "...Proces", "...Process", "...Processi", "...Processin", "...Processing",
            "...Processing.", "...Processing..", "...Processing..."
        ];

        const currentFrame = frames[llhmAnimationFrameCounter % frames.length];
        llhmAnimationFrameCounter++;

        return `${normalizedData}${currentFrame}`;
    } else {
        llhmAnimationFrameCounter = 0;
    }

    return normalizedData;
}


export function compilePromptTemplate(templateString, variables) {
    // Regular expression that finds anything inside {{ }}
    const mustacheRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*}}/g;

    return templateString.replace(mustacheRegex, (match, key) => {
        // If the variable exists in our object, replace it; otherwise, keep the tag intact
        return variables[key] !== undefined ? variables[key] : match;
    });
}
