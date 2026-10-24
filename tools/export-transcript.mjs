#!/usr/bin/env node
// Converts a Claude Code session log (.jsonl) into a readable Markdown transcript.
//
//   node tools/export-transcript.mjs <session.jsonl> <out.md> [title]
//
// Keeps the user's messages, Claude's replies, and every tool call with its result (long
// results shortened). Leaves out content the app injects behind the scenes (<system-reminder>
// blocks, hidden meta messages) and Claude's private reasoning, and redacts email addresses.

import { readFileSync, writeFileSync } from 'node:fs'

const [, , input, output, title = 'Claude Code session transcript'] = process.argv
if (!input || !output) {
  console.error('usage: node tools/export-transcript.mjs <session.jsonl> <out.md> [title]')
  process.exit(1)
}

const MAX_RESULT = 2500
const MAX_INPUT = 4000

const redact = (text) =>
  text
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email redacted]')

const clip = (text, max) =>
  text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text

const fence = (text, lang = '') => {
  const longest = Math.max(2, ...[...text.matchAll(/`+/g)].map((m) => m[0].length))
  const ticks = '`'.repeat(longest + 1)
  return `${ticks}${lang}\n${text}\n${ticks}`
}

const quote = (text) =>
  text
    .trim()
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n')

function resultText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (part.type === 'text' ? part.text : part.type === 'image' ? '[image]' : ''))
    .join('\n')
}

function describeToolInput(name, input) {
  if (!input || typeof input !== 'object') return ''
  if (name === 'Bash' || name === 'PowerShell') {
    return `${input.description ? `_${input.description}_\n\n` : ''}${fence(clip(input.command ?? '', MAX_INPUT), name === 'Bash' ? 'bash' : 'powershell')}`
  }
  if (name === 'Write') {
    return `\`${input.file_path}\`\n\n${fence(clip(input.content ?? '', MAX_INPUT))}`
  }
  if (name === 'Edit') {
    return `\`${input.file_path}\`\n\n${fence(clip(`- ${input.old_string}\n+ ${input.new_string}`, MAX_INPUT), 'diff')}`
  }
  if (name === 'Read') return `\`${input.file_path}\``
  return fence(clip(JSON.stringify(input, null, 2), MAX_INPUT), 'json')
}

const lines = readFileSync(input, 'utf8').split('\n').filter(Boolean)
const out = [
  `# ${title}`,
  '',
  `Exported from \`${input.split(/[\\/]/).pop()}\` by \`tools/export-transcript.mjs\`.`,
  'Your messages and Claude\'s replies are complete. Tool results longer than ' +
    `${MAX_RESULT} characters are shortened. Content the app injects behind the scenes (system reminders) and ` +
    'Claude\'s private reasoning are left out, and email addresses are redacted.',
  '',
]

let messages = 0
for (const line of lines) {
  let record
  try {
    record = JSON.parse(line)
  } catch {
    continue
  }
  if (record.isMeta || !record.message || (record.type !== 'user' && record.type !== 'assistant')) continue
  const when = record.timestamp ? new Date(record.timestamp).toISOString().replace('T', ' ').slice(0, 19) : ''
  const content = record.message.content
  const parts = typeof content === 'string' ? [{ type: 'text', text: content }] : (content ?? [])

  for (const part of parts) {
    if (part.type === 'text') {
      const text = redact(part.text ?? '').trim()
      if (!text) continue
      if (record.type === 'user') {
        out.push(`---`, '', `### User · ${when}`, '', quote(text), '')
      } else {
        out.push(`**Claude:**`, '', text, '')
      }
      messages++
    } else if (part.type === 'image' && record.type === 'user') {
      out.push('> [image attached]', '')
    } else if (part.type === 'tool_use') {
      out.push(`<details><summary>Tool: <code>${part.name}</code></summary>`, '', redact(describeToolInput(part.name, part.input)), '', '</details>', '')
    } else if (part.type === 'tool_result') {
      const text = redact(resultText(part.content)).trim()
      if (!text) continue
      out.push('<details><summary>Result</summary>', '', fence(clip(text, MAX_RESULT)), '', '</details>', '')
    }
  }
}

writeFileSync(output, out.join('\n') + '\n')
console.log(`${messages} messages -> ${output}`)
