#!/usr/bin/env node

import { spawn } from "child_process";
import {
  buildJsonFromScaffold,
  buildReformPrompt,
  buildScaffoldPrompt,
} from "./util/prompt";

const chalk = require("chalk");
const figlet = require("figlet");
const path = require("path");
const program = require("commander");
const prompts = require("prompts");
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
  basePath: "https://oai.valyrai.com/v1",
});
const client = new OpenAIApi(configuration);

const getScaffold = async (projectDesc: string) => {
  const reformedPrompt = buildReformPrompt(projectDesc);
  const reformResponse = await client.createCompletion({
    model: "text-davinci-003",
    prompt: reformedPrompt,
    max_tokens: 128,
    temperature: 1.0,
    top_p: 1.0,
    presence_penalty: 0.0,
    frequency_penalty: 0.0,
    stop: ["."],
  });
  const reformedDesc = reformResponse.data.choices[0].text;

  const scaffoldPrompt = buildScaffoldPrompt(reformedDesc);
  const scaffoldResponse = await client.createCompletion({
    model: "text-davinci-003",
    prompt: scaffoldPrompt,
    max_tokens: 1024,
    temperature: 0.0,
    top_p: 1.0,
    presence_penalty: 1.0,
    frequency_penalty: 0.0,
    stop: ["```"],
  });
  const humanScaffold = "/public\n" + scaffoldResponse.data.choices[0].text;

  const jsonPrompt = buildJsonFromScaffold(humanScaffold);
  const jsonResponse = await client.createCompletion({
    model: "text-davinci-003",
    prompt: jsonPrompt,
    max_tokens: 2048,
    temperature: 0.0,
    top_p: 1.0,
    presence_penalty: 1.0,
    frequency_penalty: 0.0,
    stop: ["```"],
  });

  const jsonScaffold = "{" + jsonResponse.data.choices[0].text;
  return [JSON.parse(jsonScaffold), humanScaffold];
};

program
  .version("0.0.1")
  .description("A simple CLI for automatically scaffolding NextJS projects")
  .parse(process.argv);

const projectName = program.args[0];
const projectPath = path.join(process.cwd(), projectName);
if (!projectName) {
  console.log(
    chalk.red(
      "Please provide a project name. You can do this by running `scaffold <project-name>`."
    )
  );
}

const fs = require("fs");

const fillMissingFiles = (projectPath: string, scaffoldJson: any) => {
  // Recursively get all files in the project
  const getFiles = (dir: string): string[] => {
    let files = fs.readdirSync(dir);
    files.map((filePath: string) => {
      filePath = path.join(dir, filePath);
      if (
        fs.existsSync(filePath) &&
        fs.lstatSync(filePath).isDirectory() &&
        !filePath.includes("node_modules") &&
        !filePath.includes(".git")
      ) {
        // Recurse into subdirs
        let subdirFiles = getFiles(filePath);

        // Prepend the subdir to the files
        let subFileList = subdirFiles.map((subdirFile: string) => {
          return path.join(filePath, subdirFile);
        });

        // Add the subdir files to the files array
        files = files.concat(subFileList);
      }

      return filePath;
    });

    return files;
  };

  const existingFiles = getFiles(projectPath);

  // Take in files as an object containing subdirs and files and return an array
  const scaffoldAsArray = (scaffoldJson: any) => {
    const files: string[] = [];

    const recurse = (obj: any, currentPath: string) => {
      Object.keys(obj).forEach((key) => {
        if (Object.keys(obj[key]).length === 0) {
          files.push(path.join(process.cwd(), currentPath + key));
        } else {
          recurse(obj[key], currentPath + key + "/");
        }
      });
    };

    recurse(scaffoldJson, projectName + "/");
    return files;
  };

  const scaffoldFiles = scaffoldAsArray(scaffoldJson);
  const missingFiles = scaffoldFiles.filter((file: any) => {
    return !existingFiles.includes(file);
  });

  missingFiles.forEach((file: any) => {
    fs.mkdirSync(path.dirname(file), { recursive: true }, (err: any) => {
      if (err) throw err;
    });
    fs.writeFileSync(file, "");
  });

  console.log(chalk.green("Done! Enjoy."));
  process.exit(0);
};

const createProject = async (scaffoldJson: any) => {
  // First, create the basic next project and feed the output to console
  const cmd = `yarn`;
  const args = ["create", "next-app", "-e", "with-tailwindcss", projectName];
  console.log(
    chalk.green(`Executing command to setup next app:`),
    chalk.red(cmd.concat(" ", args.join(" ")))
  );

  // check if dir exists
  if (fs.existsSync(projectPath)) {
    console.log(chalk.red("Project already exists."));
    const shouldContinue = await prompts({
      type: "confirm",
      name: "value",
      message: "Should we try to scaffold within the existing project?",
      initial: true,
    });

    if (shouldContinue.value) {
      fillMissingFiles(projectPath, scaffoldJson);
    }

    return;
  }

  const child = spawn(cmd, args);
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  child.on("exit", async (code: number) => {
    if (code === 0) {
      // If the command was successful, we can now scaffold the project
      console.log(chalk.green("Next app created successfully!"));
      console.log(chalk.green("Scaffolding project..."));

      // Get the project structure in JSON from our newly created next app
      fillMissingFiles(projectPath, scaffoldJson);
    } else {
      console.log(chalk.red("Next app creation failed. Please try again."));
    }
  });
};

console.log(
  chalk.green(
    figlet.textSync("Scaffold", {
      horizontalLayout: "full",
    })
  )
);

async function retry(description: string) {
  const scaffolds = await getScaffold(description);
  console.log(chalk.green(scaffolds[1]));

  // Check if we should proceed
  const looksGood = await prompts({
    type: "confirm",
    name: "value",
    message: "Does this look good?",
    initial: true,
  });

  // If it looks good, create the project
  if (looksGood.value) {
    await createProject(scaffolds[0]);
    return;
  }

  // Otherwise, should we try again?
  const tryAgain = await prompts({
    type: "confirm",
    name: "value",
    message: "Do you want to try again?",
    initial: true,
  });
  if (tryAgain.value) {
    await retry(description);
    return;
  }

  console.log(
    chalk.red(
      "Okay, we'll exit now. You can try again later by running `scaffold`."
    )
  );
  return;
}

(async () => {
  if (process.argv.length === 4) {
    console.log(
      chalk.green(
        `Scaffolding ${process.argv[2]} with description "${process.argv[3]}"`
      )
    );
    await retry(process.argv[3]);
  } else {
    // Ask about what the project does
    const response = await prompts({
      type: "text",
      name: "description",
      message: `What does "${projectName}" do? Try to be as descriptive as possible for best results.`,
    });

    // Get our scaffold
    await retry(response.description);
  }

  process.exit(0);
})();
