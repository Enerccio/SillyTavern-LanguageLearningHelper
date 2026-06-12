import {EXTENSION_NAME, TAG_ANCHOR, TAG_BLOCK, TAG_COACH, TAG_EXPLANATION, TAG_NOTES, TAG_TRANSLATION} from './conf.js';
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
    const coachRegex = /\[LLH_COACH\][\s\S]*?\[\/LLH_COACH\]/gi;

    const inlineAnchorRegex = /\[LLH_FN_[a-z0-9_-]+\]/gi;

    return messages.map(msg => {
        if (msg.role === 'assistant' && typeof msg.content === 'string') {
            let cleanContent = msg.content
                .replace(appendixRegex, '')
                .replace(coachRegex, '')
                .replace(inlineAnchorRegex, '')
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
    const safeLookaheadRegex = /(?:\[TRANSLATION_NOTES\](?![\s\S]*?\[\/TRANSLATION_NOTES\])[\s\S]*|\[BLOCK\](?![\s\S]*?\[\/BLOCK\])[\s\S]*|\[LLH_COACH\](?![\s\S]*?\[\/LLH_COACH\])[\s\S]*)$/i;

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

export function processCoachTags(data, ctx) {
    if (typeof data !== 'string') return data;
    if (ctx.isReasoning) return data;

    let normalized = data
        .replace(/(<p>)?\s*\[LLH_COACH\]/gi, (match, pTag) => {
            return pTag ? `<${TAG_COACH}><p>` : `<${TAG_COACH}>`;
        })
        .replace(/\[\/LLH_COACH\]\s*(<\/p>)?/gi, (match, pTag) => {
            return pTag ? `</p></${TAG_COACH}>` : `</${TAG_COACH}>`;
        });

    const coachRegex = new RegExp(`<${TAG_COACH}>([\\s\\S]*?)</${TAG_COACH}>`, 'gi');
    normalized = normalized.replace(coachRegex, (match, content) => {
        let escapedContent = content
            .replace(/「/g, '&#12300;')
            .replace(/」/g, '&#12301;')
            .replace(/"/g, '&quot;')
            .replace(/“/g, '&#8220;')
            .replace(/”/g, '&#8221;')
            .replace(/『/g, '&#12302;')
            .replace(/』/g, '&#12303;');

        // Clean up empty paragraph tags and breaks inside the coach block
        escapedContent = escapedContent
            .replace(/<p>\s*<\/p>/gi, '')
            .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, '')
            .replace(/^(?:\s*<br\s*\/?>)+/gi, '')  // Strip leading breaks
            .replace(/(?:\s*<br\s*\/?>)+$/gi, ''); // Strip trailing breaks

        // Remove all whitespace between the tags and the outer content boundaries
        escapedContent = escapedContent
            .replace(/^\s*(?=<)/g, '')   // Strip whitespace between tag coach and first <
            .replace(/(?<=>)\s*$/g, '');  // Strip whitespace between last > and /tag coach

        return `<${TAG_COACH}>${escapedContent}</${TAG_COACH}>`;
    });

    // Clean up empty paragraphs immediately adjacent to the coach block
    const emptyBeforeRegex = new RegExp(`<p>\\s*</p>\\s*<${TAG_COACH}>`, 'gi');
    const emptyAfterRegex = new RegExp(`</${TAG_COACH}>\\s*<p>\\s*</p>`, 'gi');
    normalized = normalized
        .replace(emptyBeforeRegex, `<${TAG_COACH}>`)
        .replace(emptyAfterRegex, `</${TAG_COACH}>`);

    return normalized;
}


export function compilePromptTemplate(templateString, variables) {
    // Regular expression that finds anything inside {{ }}
    const mustacheRegex = /\{\{\s*([a-zA-Z0-9_]+)\s*}}/g;

    return templateString.replace(mustacheRegex, (match, key) => {
        // If the variable exists in our object, replace it; otherwise, keep the tag intact
        return variables[key] !== undefined ? variables[key] : match;
    });
}
