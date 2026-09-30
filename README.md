# Wordy

A voice tutor that teaches ten words people use at work, then talks you through using each one out loud.

**Live:** https://wordy-tutor.netlify.app

You hear a word, its meaning and an example. You answer by speaking a sentence of your own. Wordy tells you how it
landed, gives you one retry if the sense was off, and brings missed words back at the end. You can interrupt at any
point: ask what a word means, ask for another example, say "next" to skip, or say "practise mitigate" to go back to a
word. With hands-free on, the mic reopens after every reply, so it runs like a phone call.

## How a turn works

```
you speak ──► speech to text        browser speech recognition (Indian English)
                   │
                   ▼
              the page (app.js)     keeps the conversation and the last 10 turns
                   │  POST /api/chat {text, word, finalTry, history}
                   ▼
              tutor function        Groq model, returns {reply, verdict}
                   │                if it fails or is slow: a rule-based tutor in the browser
                   ▼
              lesson rules          verdict decides the score, retries, queue and when to move on
                   │
you hear ◄─── text to speech        browser voices, UK English preferred
```

The verdict is one of `correct`, `wrong_sense`, `missing_word`, `not_sentence`, `chat` or `skip`.

## Design decisions

**The model writes the words, the page keeps the score.** The tutor only returns a reply and a verdict. The page
decides what a verdict means: it counts attempts, allows one retry, sends a missed word to the back of the queue and
chooses when to move on. A confused or chatty reply can never skip a word or mark one cleared by accident.

**The server holds its own copy of the word set.** The page only says which word it is on. Definitions and examples
sent to the model come from the server, so nobody can feed it a made-up meaning.

**The function checks the model.** If the model says `correct` but the word was never actually said, the verdict is
overridden before it reaches the page.

**It degrades instead of breaking.** Groq's free tier limits each model separately, so a rate-limited model hands the
turn to the next one (Qwen 3.8 27B, then gpt-oss-20b, then gpt-oss-120b). If all of them fail or take longer than a
few seconds, the page switches to a rule-based tutor that runs in the browser, and the status line says which tutor is
answering.

**The key never reaches the browser.** It lives in a Netlify environment variable and is read only by the function.
The function also refuses requests from other origins, words outside the set, anything that isn't a POST, and callers
who send more than 40 turns in 10 minutes. The prompt treats the learner's text as content to judge, never as
instructions.

## Model choice

Twelve fixed tutor turns with known correct verdicts, including traps: "I will mitigate to Canada" (confused with
*migrate*), "the mitigation plan" (the noun, not the verb) and a prompt-injection attempt. Run with
`node bench.mjs <model>`.

| Model | Verdicts right | Median response |
|---|---|---|
| qwen/qwen3.8-27b | 12 of 12 | 280 ms |
| openai/gpt-oss-20b | 10 of 10 answered | 531 ms |
| openai/gpt-oss-120b | 10 of 11 answered | 695 ms |

The gpt-oss runs hit the free-tier rate limit before finishing, which is what led to the fallback chain. Qwen was
also the most natural to listen to, with short replies and no exclamation marks.

## Run it locally

Needs Node 20.12 or later and a [Groq API key](https://console.groq.com/keys).

```
echo GROQ_API_KEY=your_key > .env
node dev.mjs
```

Then open http://127.0.0.1:8732 in Chrome or Edge. `dev.mjs` serves `public/` and runs the function at `/api/chat` the
same way Netlify does. Without a key the page still works, using the rule-based tutor.

## Deploy

On Netlify, `netlify.toml` publishes `public/` and serves `netlify/functions/chat.mjs` at `/api/chat`. Set these
environment variables:

| Variable | Required | Purpose |
|---|---|---|
| `GROQ_API_KEY` | yes | Groq key used by the function |
| `GROQ_MODELS` | no | comma-separated fallback order, defaults to the three above |
| `ALLOWED_ORIGINS` | no | extra origins allowed to call the function, such as a custom domain |

## Files

| Path | What it is |
|---|---|
| `public/index.html`, `app.css`, `app.js` | the whole front end, no build step and no dependencies |
| `netlify/functions/chat.mjs` | the tutor: prompt, Groq call, fallback chain and guards |
| `dev.mjs` | local server that behaves like Netlify |
| `bench.mjs` | the model benchmark above |

## Limits

- Voice input works in Chrome and Edge. Elsewhere, or with the microphone blocked, you type instead.
- Voices come from the browser, so they sound different on different devices.
- Progress resets when the page is reloaded.
- The rule-based fallback judges meaning with a keyword list per word, so it is far blunter than the model.
- Groq's free tier allows roughly eight turns a minute per model, which suits a demo, not heavy traffic.

## What a real version would add

A review schedule per learner so words return days later rather than minutes, word sets chosen by goal, pronunciation
feedback, and hosted speech in and out (Whisper and a server-side voice) so it sounds the same and works on every
device.
