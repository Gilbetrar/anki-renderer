/**
 * Demo site main script
 */

// Dynamic import based on environment
const isProduction = import.meta.env.PROD;
const libPath = isProduction ? '/anki-renderer/lib/index.js' : '../../dist/index.js';

let renderCard, initWasm, DEFAULT_ANKI_CSS, NIGHT_MODE_CSS;

async function loadLibrary() {
  const lib = await import(/* @vite-ignore */ libPath);
  renderCard = lib.renderCard;
  initWasm = lib.initWasm;
  DEFAULT_ANKI_CSS = lib.DEFAULT_ANKI_CSS;
  NIGHT_MODE_CSS = lib.NIGHT_MODE_CSS;
}

// Example configurations
const EXAMPLES = {
  basic: {
    front: '{{Front}}',
    back: '{{FrontSide}}<hr>{{Back}}',
    fields: { Front: 'What is 2 + 2?', Back: '4' },
    cardOrdinal: 0,
    css: '',
  },
  cloze: {
    front: '{{cloze:Text}}',
    back: '{{cloze:Text}}',
    fields: { Text: '{{c1::Paris}} is the capital of {{c2::France}}' },
    cardOrdinal: 1,
    css: '',
  },
  hint: {
    front: 'What color is the sky?\n\n{{hint:Hint}}',
    back: '{{FrontSide}}<hr>{{Answer}}',
    fields: { Hint: 'Look up on a clear day', Answer: 'Blue' },
    cardOrdinal: 0,
    css: '',
  },
  furigana: {
    front: '{{furigana:Word}}',
    back: '{{furigana:Word}}<hr>{{Meaning}}',
    fields: { Word: '日本語[にほんご]', Meaning: 'Japanese language' },
    cardOrdinal: 0,
    css: '',
  },
  styled: {
    front: '{{Front}}',
    back: '{{FrontSide}}<hr>{{Back}}',
    fields: { Front: 'Styled card example', Back: 'With custom colors!' },
    cardOrdinal: 0,
    css: `.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 12px;
  padding: 2rem;
}`,
  },
  filters: {
    front: 'HTML content: {{text:Content}}\n\nType your answer: {{type:Answer}}',
    back: '{{FrontSide}}<hr>Correct: {{Answer}}',
    fields: { Content: '<b>Bold</b> and <i>italic</i>', Answer: 'test' },
    cardOrdinal: 0,
    css: '',
  },
};

// DOM elements
let templateFront;
let templateBack;
let fieldsJson;
let cardOrdinal;
let nightMode;
let defaultStyles;
let customCss;
let cardPreview;
let previewContainer;
let showQuestion;
let showAnswer;

let currentSide = 'question';
let lastResult = null;

/**
 * Initialize the demo
 */
async function init() {
  // Get DOM references
  templateFront = document.getElementById('template-front');
  templateBack = document.getElementById('template-back');
  fieldsJson = document.getElementById('fields-json');
  cardOrdinal = document.getElementById('card-ordinal');
  nightMode = document.getElementById('night-mode');
  defaultStyles = document.getElementById('default-styles');
  customCss = document.getElementById('custom-css');
  cardPreview = document.getElementById('card-preview');
  previewContainer = document.getElementById('preview-container');
  showQuestion = document.getElementById('show-question');
  showAnswer = document.getElementById('show-answer');

  // Load library and initialize WASM
  try {
    cardPreview.innerHTML = '<div style="color: #666;">Loading library...</div>';
    await loadLibrary();
    await initWasm();
    console.log('WASM initialized');
  } catch (error) {
    console.error('Failed to initialize:', error);
    cardPreview.innerHTML = `<div style="color: red;">Failed to load renderer: ${error.message}</div>`;
    return;
  }

  // Set up event listeners
  templateFront.addEventListener('input', render);
  templateBack.addEventListener('input', render);
  fieldsJson.addEventListener('input', render);
  cardOrdinal.addEventListener('input', render);
  nightMode.addEventListener('change', render);
  defaultStyles.addEventListener('change', render);
  customCss.addEventListener('input', render);

  showQuestion.addEventListener('click', () => setSide('question'));
  showAnswer.addEventListener('click', () => setSide('answer'));

  // Set up example buttons
  document.querySelectorAll('.example-card').forEach((card) => {
    const btn = card.querySelector('.try-btn');
    const exampleKey = card.dataset.example;
    btn.addEventListener('click', () => loadExample(exampleKey));
  });

  // Initial render
  await render();
}

/**
 * Set which side to display
 */
function setSide(side) {
  currentSide = side;
  showQuestion.classList.toggle('active', side === 'question');
  showAnswer.classList.toggle('active', side === 'answer');
  displayResult();
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
  cardOrdinal.value = example.cardOrdinal;
  customCss.value = example.css;

  render();

  // Scroll to demo section
  document.getElementById('demo').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Render the card preview
 */
async function render() {
  // Parse fields
  let fields;
  try {
    fields = JSON.parse(fieldsJson.value);
  } catch {
    cardPreview.innerHTML = '<div style="color: red;">Invalid JSON in fields</div>';
    return;
  }

  // Build options
  const options = {
    front: templateFront.value,
    back: templateBack.value,
    fields,
    cardOrdinal: parseInt(cardOrdinal.value) || 0,
  };

  try {
    lastResult = await renderCard(options);
    displayResult();
  } catch (error) {
    cardPreview.innerHTML = `<div style="color: red;">Render error: ${error.message}</div>`;
  }
}

/**
 * Display the rendered result
 */
function displayResult() {
  if (!lastResult) return;

  const content = currentSide === 'answer' ? lastResult.answer : lastResult.question;

  // Build CSS
  const cssParts = [];
  if (defaultStyles.checked) {
    cssParts.push(DEFAULT_ANKI_CSS);
  }
  if (nightMode.checked) {
    cssParts.push(NIGHT_MODE_CSS);
  }
  if (customCss.value) {
    cssParts.push(customCss.value);
  }

  // Update container class for night mode
  previewContainer.classList.toggle('night-mode', nightMode.checked);

  // Create styled card wrapper
  const cardClass = nightMode.checked ? 'card nightMode' : 'card';
  const styleTag = cssParts.length ? `<style>${cssParts.join('\n')}</style>` : '';

  cardPreview.innerHTML = `${styleTag}<div class="${cardClass}">${content}</div>`;
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
