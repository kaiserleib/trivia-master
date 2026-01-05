# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **Frontend**: Vite + React
- **Database & Auth**: Supabase
- **Deployment**: Vercel
- **CI/CD**: GitHub Actions
- **Email**: Resend (not Supabase edge functions)

## Authentication

Support these auth methods via Supabase Auth:
- Google OAuth
- Email/password
- Magic link

---

# Trivia Master - the master of trivia!

For the past year and a half, I've been running a weekly trivia night at a local brewery. My current workflow is as follows: 

1. I visit claude.ai and open the running chat where I ask Claude to create four rounds of trivia about given topics, one topic of ten questions per round - the reason for the persistent chat is that we have a dedicated format, with multiple-choice questions (answer a b c or d) followed by short-answer questions (what is the capital of Nigeria?). This structure includes answers after each question, identified as **Answer:** Abuja. If we had a new chat the formatting would be inconsistent and the script we use later would fail. 
2. I copy Claude's proposed questions and answers, precisely formatted, into a google doc stored in my drive. Here I review the questions for sensibility, often rearranging them so that a short-answer question becomes a multiple choice question or vice-versa, or completely deleting a question I don't think makes sense and creating a new question out of whole cloth. Sometimes I also reformat the questions to make it possible to give a meaningful answer or to remove the answer from the wording of the question. 
3. I copy and paste the google doc's ID into a google apps script which transforms the doc into a google slides presentation - a cover slide that introduces trivia with today's date, then a slide for "Round 1: Classic Cars" or what-have-you, followed by a slide for each question. 
4. I print the google doc to allow me to grade and correct each team's responses between rounds. 
5. I connect my laptop to the projector via Apple's screen mirroring, and launch the full-screen slideshow. I set up the microphone and adjust the volume on the overhead speakers.
6. I distribute pens and answer sheets to each trivia team.
7. I ask the first round of questions, advancing the slideshow to each question, and engaging in banter with the audience and telling jokes.
8. I collect the answers from the first round. 
9. I ask the first question from the second round, advancing the slideshow as appropriate, then grade one team's answer sheet and record their score, then ask the second question, then grade another team's answer sheet, until all the answer sheets are graded and all the questions are asked. If there are more teams than questions I have to grade two teams between questions occasionally, and if there are more questions than teams I ask the last few questions without having anything to grade in between. At the end of the round, I collect the answer sheets. 
10. I return the slideshow to the first round, and inform the teams of the answers to each question. Much hilarity ensues because they often make jokes in their answers, or I gently roast them for being wrong, or gently roast myself for my nonsensical trivia.
11. I repeat the second-round process for the third and fourth rounds, grading answers during the round, then reviewing. At the end of each round I announce the running total score for each team. 
12. At the end of the four rounds I announce the overall winner for the night's contest and their team receives one free beer each from the brewery. 

The technical lift here is not unbearable, especially since i am able to use claude to generate questions, and editing is not difficult. However, it is still more complicated than it needs to be, and it's not approachable by guest hosts who resort to writing their own questions since my slideshow process is so frustrating. It's also a very manual process to re-use old rounds and questions if I find myself short on time. 

I'd like to create a software application that handles this process for me end-to-end, starting with a tool to call Claude and grab the list of questions, proceeding to a markdown interface from which I can edit each round, and then to a presentation view where I can present the equivalent of my google slideshow without the janky intermediate step. I'd also like to store the questions as individual question records, associate the questions with their authors and the round, and associate the round with the night's overall question set. I'd like myself and other users to be able to create new rounds of trivia using our existing library of questions, to create new rounds of trivia from scratch using the markdown interface without using an LLM, or to be able to call Claude to seed the round. 