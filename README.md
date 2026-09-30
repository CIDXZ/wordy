# Wordy

A small voice tutor I made. It teaches you ten words that come up at work and gets you to use each one out loud.

Try it here: https://wordy-tutor.netlify.app (Chrome or Edge, with your mic on)

## What it does

It says a word, what it means and an example. You say a sentence with it and it tells you if you got it right. Get it
wrong and you get one more go, miss it again and it comes back at the end.

You can talk to it the whole time too. Ask what a word means, ask for another example, say "next" to skip, or say
"practise mitigate" to go back to a word. With hands-free on, the mic opens by itself after each reply, so you never
have to click anything.

## How it's put together

The front end is plain HTML, CSS and JS in `public/`, with no build step. Your browser does the speech to text and the
text to speech.

Each answer goes to a Netlify function, `netlify/functions/chat.mjs`, which asks a model on Groq for two things: a
verdict on your sentence and what to say back. The verdict is one of `correct`, `wrong_sense`, `missing_word`,
`not_sentence`, `chat` or `skip`.

A few decisions worth pointing out:

- The model only gives a verdict and a reply. The app keeps the score and decides when to move on, so the model can't
  skip a word or mark one right by mistake.
- The function has its own copy of the words and definitions. The browser only says which word it's on, so nobody can
  feed the model a fake meaning.
- If the model says "correct" but the word never showed up in your sentence, the function overrides it.
- Groq's free tier rate limits each model separately, so if one is busy the function tries the next: Qwen 3.8 27B, then
  gpt-oss-20b, then gpt-oss-120b. If they all fail, the browser falls back to a simple keyword checker and the lesson
  keeps going.
- The API key only lives on Netlify. The function also turns away requests from other sites, words outside the set,
  and anyone sending more than 40 turns in 10 minutes.

## Picking the model

I ran twelve test turns with known right answers through each model, including a few traps like "I will mitigate to
Canada" (mixing it up with migrate) and "the mitigation plan" (the noun, not the verb). `node bench.mjs <model>` runs
it.

| Model | Right | Median response |
|---|---|---|
| qwen/qwen3.8-27b | 12 of 12 | 280 ms |
| openai/gpt-oss-20b | 10 of 10 answered | 531 ms |
| openai/gpt-oss-120b | 10 of 11 answered | 695 ms |

Qwen got all twelve and was faster by a lot. It also sounded the most natural read out loud, with short replies and no
"Great job!" every time. The gpt-oss runs hit the rate limit before finishing, which is why the fallback chain exists.

## Running it yourself

You need Node 20.12 or newer and a [Groq API key](https://console.groq.com/keys).

```
echo GROQ_API_KEY=your_key > .env
node dev.mjs
```

Then open http://127.0.0.1:8732 in Chrome or Edge. `dev.mjs` serves the site and runs the function the same way
Netlify does. Without a key it still works, just with the keyword checker.

To deploy on Netlify, `netlify.toml` already points at the right folders. Set `GROQ_API_KEY`, and if you want,
`GROQ_MODELS` (the fallback order, comma separated) or `ALLOWED_ORIGINS` (extra sites allowed to call the function).

## What it's bad at

Voice only works in Chrome and Edge. The voice depends on your browser, so it sounds different everywhere. Progress
resets when you reload. The fallback checker is just keyword matching, so it's easy to fool. And Groq's free tier
handles about eight turns a minute per model, which is fine for trying it out but not for real traffic.

## If I kept going

Words coming back days later instead of minutes later, word sets for different goals like interviews or sales calls,
pronunciation feedback, and doing the speech on the server (Whisper in, a proper voice out) so it sounds the same and
works on every device.
