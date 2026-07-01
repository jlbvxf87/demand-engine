# Demand Engine — Ad Intelligence System

**AI system that scrapes the Facebook Ad Library, identifies winning ad patterns, decodes creative frameworks, and generates new ad concepts for testing.**

_This public repo is a sanitized demonstration based on real implementation patterns. Client-specific code, credentials, data, and proprietary logic have been removed._

---

## Business Problem

Most paid media teams operate on instinct or small internal data sets. The Facebook Ad Library contains millions of running ads — a massive public dataset of what's actually working — but there is no tool that systematically mines it for actionable creative intelligence.

## What I Built

A pipeline that scrapes the Ad Library, structures the data, uses LLMs to decode hooks, angles, offers, and CTAs, identifies winning creative patterns, and generates ready-to-test ad concepts.

## Key Features

- Scrapes public Facebook Ad Library by competitor, keyword, or category
- LLM-powered creative decoding: hook type, offer structure, CTA pattern, creative format
- Pattern clustering to identify repeating winning creative frameworks
- Ad concept regeneration: takes winning patterns and creates testable variations
- Export to structured format for creative teams and campaign managers

## Tech Stack

**Scraping:** JavaScript | Playwright

**Backend:** Node.js | TypeScript | Supabase

**AI/LLM:** OpenAI GPT-4 (structured output) | Claude API

**Frontend:** Next.js | TypeScript | Tailwind CSS | Vercel

## Revenue Relevance

Reduces time-to-insight for paid media teams from days to minutes. Surfaces what is working in market before running budget. Informs creative briefs with real market data rather than guesswork.

## Demo

Live demo: https://demand-engine-2.vercel.app

## Security Note

No proprietary scraping infrastructure, private account data, or client creative assets are included in this demo. See .env.example for required variables.

## What This Proves to Hiring Teams

- LLM pipeline design and prompt engineering at scale
- Data pipeline architecture: scrape, structure, analyze, output
- AI-powered business intelligence from public data sources
- Practical implementation of LLMs in a direct revenue workflow
