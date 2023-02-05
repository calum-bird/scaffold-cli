export const buildReformPrompt = (projectDesc: string) => {
  return `Transform the following description into a gramatically-correct prompt that fits a format like this:

Format: I am hoping to build a webapp that [description].
Description: ${projectDesc}
Reformed Prompt: I am hoping to build a webapp that `;
};

export const buildScaffoldPrompt = (reformedDesc: string) => {
  return `I want to create a useful webapp using Next.JS and TypeScript. We're going to use the industry-standard folder structure like so:
\`\`\`plaintext
/public
    favicon.ico (always include)
    [asset].* (optional, do not include if we don't need assets)=
/lib (optional, do not include if we don't need any utilities)
    [utility_name].ts
/components (required, we will always have at least one component)
    [component_name].tsx
/pages (required)
    /api (optional folder, do not include if we don't need a backend)
        /[optional route folder]
            [route_name].ts
        [base_route].ts (optional, do not include if all routes are in folders)
    _app.tsx (required)
    index.tsx (required)
    [page_name].tsx (do not include for simple apps that can be a single page)
/styles (required)
    [style_name].module.css (optional, do not include if we don't need styles)
    globals.css (required for tailwind)
\`\`\`

With that in mind, I want to build a webapp that ${reformedDesc}. Here is the folder structure that efficiently comprises my project:
\`\`\`plaintext
/public
`;
};

export const buildJsonFromScaffold = (scaffold: string) => {
  return `Take a look at the following folder structure:
\`\`\`plaintext
${scaffold}
\`\`\`

Write the folder structure as a JSON object:
\`\`\`json
{`;
};
