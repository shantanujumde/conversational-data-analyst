# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + Vite + TypeScript, shadcn/ui on Tailwind CSS, Recharts. Backend: Node.js + Express + TypeScript, SQLite. Full detail in SPEC.md.

## Users

A bank operations or branch manager at an office desktop during the workday. They check numbers between other tasks, for example "which branch is slipping this month?", and want a quick answer they can trust and pass on.

## Product Purpose

Ask a business question in plain English and get an answer drawn from the bank's structured data: a sentence, a KPI, a table, a bar chart or a line chart. Success: the manager gets a correct, readable answer in one step and can copy the text, the data or the chart into an email or report.

## Positioning

Every answer is computed from real rows by a checked query, never written by the AI. The AI only picks from a fixed list of datasets, measures and breakdowns; the server builds the SQL. The answer can show exactly which data and query produced it.

## Operating Context

Built as a 60-minute, screen-recorded interview exercise. Single-turn questions, no login, no saved history. Data covers branches, customers, onboarding applications and transactions, in INR.

## Capabilities and Constraints

- Answer types: text, KPI card, table, bar chart, line chart.
- Copy actions: answer text, data as CSV, chart as PNG.
- No matching rows: a sentence saying nothing matched.
- Questions outside the catalog (the fixed list of datasets, measures and breakdowns) are refused, with up to three suggested questions the app can answer.
- Technical failure: a plain reason and a Try again button.

## Brand Commitments

User-stated and binding: the UI should feel like paper; use animation; not cluttered; clear; very simple; no cognitive load. It must not look like a ChatGPT clone or a stock shadcn template.

## Evidence on Hand

Synthetic, seeded banking data only (8 branches, 200 customers, 1,500 applications, 5,000 transactions). No real customers, logos or bank brand. Nothing may be presented as a real bank's data.

## Product Principles

1. The number is the hero; everything else steps back.
2. Show where an answer came from, on request, never by default.
3. One question, one clear answer, no setup.
4. Refuse honestly rather than guess.
