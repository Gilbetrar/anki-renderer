/**
 * Demo site main script.
 *
 * Drives an <anki-card-preview> web component, which renders cards through
 * the anki-renderer service (Anki's official engine) — no WASM involved.
 */

// Served from the repo's dist/ in dev (vite middleware) and from a copied
// lib/ directory in production builds
const componentPath = '/lib/component.js';

const SERVICE_URL = 'https://anki-renderer.bjblabs.com/api';

// Example configurations
const EXAMPLES = {
  basic: {
    front: '{{Front}}',
    back: '{{FrontSide}}<hr>{{Back}}',
    fields: { Front: 'What is 2 + 2?', Back: '4' },
    cloze: false,
    cardOrd: 0,
    css: '',
  },
  cloze: {
    front: '{{cloze:Text}}',
    back: '{{cloze:Text}}',
    fields: { Text: '{{c1::Paris}} is the capital of {{c2::France}}' },
    cloze: true,
    cardOrd: 0,
    css: '',
  },
  hint: {
    front: 'What color is the sky?\n\n{{hint:Hint}}',
    back: '{{FrontSide}}<hr>{{Answer}}',
    fields: { Hint: 'Look up on a clear day', Answer: 'Blue' },
    cloze: false,
    cardOrd: 0,
    css: '',
  },
  furigana: {
    front: '{{furigana:Word}}',
    back: '{{furigana:Word}}<hr>{{Meaning}}',
    fields: { Word: '日本語[にほんご]', Meaning: 'Japanese language' },
    cloze: false,
    cardOrd: 0,
    css: '',
  },
  styled: {
    front: '{{Front}}',
    back: '{{FrontSide}}<hr>{{Back}}',
    fields: { Front: 'Styled card example', Back: 'With custom colors!' },
    cloze: false,
    cardOrd: 0,
    css: `.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 2rem;
}`,
  },
  filters: {
    front: 'HTML content: {{text:Content}}',
    back: '{{FrontSide}}<hr>{{Content}}',
    fields: { Content: '<b>Bold</b> and <i>italic</i>' },
    cloze: false,
    cardOrd: 0,
    css: '',
  },
  punctuated: {
    front: '{{Source (book, article, etc.)}}',
    back: '{{FrontSide}}<hr>{{Notes}}',
    fields: {
      'Source (book, article, etc.)': 'How to Take Smart Notes',
      Notes: 'Field names with punctuation render fine — this broke the old WASM renderer (issue #20).',
    },
    cloze: false,
    cardOrd: 0,
    css: '',
  },
};

// DOM elements
let templateFront;
let templateBack;
let fieldsJson;
let clozeCheckbox;
let cardOrd;
let nightMode;
let customCss;
let cardPreview;
let previewContainer;
let showQuestion;
let showAnswer;

/** The <anki-card-preview> element driving the preview */
let preview;

/**
 * Initialize the demo
 */
async function init() {
  // Get DOM references
  templateFront = document.getElementById('template-front');
  templateBack = document.getElementById('template-back');
  fieldsJson = document.getElementById('fields-json');
  clozeCheckbox = document.getElementById('cloze');
  cardOrd = document.getElementById('card-ord');
  nightMode = document.getElementById('night-mode');
  customCss = document.getElementById('custom-css');
  cardPreview = document.getElementById('card-preview');
  previewContainer = document.getElementById('preview-container');
  showQuestion = document.getElementById('show-question');
  showAnswer = document.getElementById('show-answer');

  // Load the web component (registers <anki-card-preview>)
  try {
    cardPreview.innerHTML = '<div style="color: #666;">Loading component...</div>';
    await import(/* @vite-ignore */ componentPath);
  } catch (error) {
    console.error('Failed to load component:', error);
    cardPreview.innerHTML = `<div style="color: red;">Failed to load component: ${error.message}</div>`;
    return;
  }

  // Create the preview element
  preview = document.createElement('anki-card-preview');
  preview.setAttribute('service-url', SERVICE_URL);
  preview.setAttribute('side', 'question');
  cardPreview.innerHTML = '';
  cardPreview.appendChild(preview);

  // Set up event listeners (the component debounces re-renders itself)
  templateFront.addEventListener('input', syncPreview);
  templateBack.addEventListener('input', syncPreview);
  fieldsJson.addEventListener('input', syncPreview);
  clozeCheckbox.addEventListener('change', syncPreview);
  cardOrd.addEventListener('input', syncPreview);
  nightMode.addEventListener('change', syncPreview);
  customCss.addEventListener('input', syncPreview);

  showQuestion.addEventListener('click', () => setSide('question'));
  showAnswer.addEventListener('click', () => setSide('answer'));

  // Set up example buttons
  document.querySelectorAll('.example-card').forEach((card) => {
    const btn = card.querySelector('.try-btn');
    const exampleKey = card.dataset.example;
    btn.addEventListener('click', () => loadExample(exampleKey));
  });

  // Show the engine version in the footer
  showEngineVersion();

  // Initial render
  syncPreview();
}

/**
 * Fetch the service health check and display the Anki engine version.
 */
async function showEngineVersion() {
  const versionEl = document.getElementById('engine-version');
  if (!versionEl) return;
  try {
    const res = await fetch(`${SERVICE_URL}/healthz`);
    const data = await res.json();
    versionEl.textContent = `Rendering engine: Anki ${data.ankiVersion}`;
  } catch {
    versionEl.textContent = 'Rendering service unreachable';
  }
}

/**
 * Set which side to display
 */
function setSide(side) {
  showQuestion.classList.toggle('active', side === 'question');
  showAnswer.classList.toggle('active', side === 'answer');
  preview.setAttribute('side', side);
}

/**
 * Load an example configuration
 */
function loadExample(key) {
  const example = EXAMPLES[key];
  if (!example) return;

  templateFront.value = example.front;
  templateBack.value = example.back;
  fieldsJson.value = JSON.stringify(example.fields, null, 2);
  clozeCheckbox.checked = example.cloze;
  cardOrd.value = example.cardOrd;
  customCss.value = example.css;

  syncPreview();

  // Scroll to demo section
  document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Push the editor state onto the component's attributes.
 */
function syncPreview() {
  // Validate fields JSON before handing it to the component
  try {
    JSON.parse(fieldsJson.value);
    fieldsJson.classList.remove('invalid');
  } catch {
    fieldsJson.classList.add('invalid');
    return;
  }

  preview.setAttribute('template-front', templateFront.value);
  preview.setAttribute('template-back', templateBack.value);
  preview.setAttribute('fields', fieldsJson.value);

  if (clozeCheckbox.checked) {
    preview.setAttribute('cloze', '');
  } else {
    preview.removeAttribute('cloze');
  }
  preview.setAttribute('card-ord', String(parseInt(cardOrd.value, 10) || 0));

  if (customCss.value) {
    preview.setAttribute('css', customCss.value);
  } else {
    preview.removeAttribute('css');
  }

  if (nightMode.checked) {
    preview.setAttribute('night-mode', '');
  } else {
    preview.removeAttribute('night-mode');
  }
  previewContainer.classList.toggle('night-mode', nightMode.checked);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
