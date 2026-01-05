export const triviaPrompt = (topic: string) => `Generate 10 trivia questions about "${topic}".

Format each question exactly like this:
- Alternate between short-answer questions and multiple-choice questions
- For short-answer: just the question followed by Answer: on the next line
- For multiple-choice: question followed by A) B) C) D) options, then Answer: with the letter and answer

Example format:
1. What is the capital of France?
Answer: Paris

2. Which planet is known as the Red Planet? A) Venus B) Mars C) Jupiter D) Saturn
Answer: B) Mars

Now generate 10 trivia questions about "${topic}":`
