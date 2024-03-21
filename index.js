#!/usr/bin/env node

import util from 'util';
import { exec as exec0 } from 'child_process';
import { readFile, writeFile } from 'node:fs/promises';
import inquirer from 'inquirer';

const PACKAGE_JSON = 'package.json';
const INDEX_JS = 'index.js';
const ENCODING = 'utf8';

/**
 * The project's index.js file is overwritten with this,
 * if the user indicates they are going to create a script.
 */
const TEMPLATE_INDEX_JS_SCRIPT = `import { about } from './src/sknups.js';

async function main () {
  console.log('Hello, world!');
  console.log(about());
}

await main();
`;

/**
 * The project's index.js file is overwritten with this,
 * if the user indicates they are going to create a library.
 */
const TEMPLATE_INDEX_JS_LIBRARY = `import { about } from './src/sknups.js';

const SKNUPS = {
  about
};

export { SKNUPS };
`;

/**
 * Invoke a command in the shell and return the standard output.
 *
 * @param {string} command
 * @returns {Promise<string>}
 */
async function execute (command) {

  /**
   * @type {(command: string) => Promise<{stdout: string, stderr: string}>}
   */
  const exec = util.promisify(exec0);

  const { stdout } = await exec(command);
  return stdout.trim();

}

/**
 * Modifies the specified object by setting a value at the specified key.
 * Equivalent to:
 *
 *   data[key] = value; // if key is a string
 *
 *   data[key[0]][key[1]] = value; // if key is an array
 *
 * @param {object} data
 * @param {string|string[]} key
 * @param {string|boolean} value
 * @returns {object}
 */
function set (data, key, value) {
  const selector = Array.isArray(key) ? key : [key];
  let selected = data;
  while (selector.length > 1) {
    selected = selected[selector.shift()];
  }
  selected[selector[0]] = value;
  return data;
}

/**
 * [over]write a key-value pair in the package.json file
 *
 * @param {string | string[]} key
 * @param {string | boolean} value
 * @returns {Promise<void>}
 */
async function writePackageJson (key, value) {
  const data = JSON.parse(await readFile(PACKAGE_JSON, ENCODING));
  set(data, key, value);
  await writeFile(PACKAGE_JSON, JSON.stringify(data, null, 2), ENCODING);
}

/**
 * [over]write the index.js file
 *
 * @param {string} data
 * @returns {Promise<void>}
 */
async function writeIndexJs (data) {
  await writeFile(INDEX_JS, data, ENCODING);
}

/**
 * @param {string} variable e.g. npm_public_writer_repositories
 * @param {string} repository e.g. sknups/drop-links
 */
function printTerraformMessage (variable, repository) {
  console.log();
  console.log(`To authorize GitHub Workflows you must modify this Terraform:
https://github.com/sknups/sknups-terraform/blob/main/main.tf

--------------------------------------------------------------------------------
${variable} = [
  "${repository}"
]
--------------------------------------------------------------------------------
`);
}

async function main () {

  // https://github.com/sknups/drop-links.git
  const url = (await execute('git config --get remote.origin.url'));

  // sknups/drop-links
  const repository = url.replace('https://github.com/', '').replace('.git', '');

  // sknups
  const organisation = repository.split('/')[0];

  // drop-links
  const name = repository.split('/')[1];

  // noinspection JSCheckFunctionSignatures
  let answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      default: name,
      message: 'What is the project name?'
    },
    {
      type: 'list',
      name: 'nature',
      default: 0,
      message: 'Are you creating a script, or a library?',
      choices: [
        { value: 'script', name: 'script (standalone program)' },
        { value: 'library', name: 'library (npm package)' }
      ],
    }

  ]);

  switch (answers.nature) {
    case 'script':
      await writePackageJson(['repository', 'url'], `git+${url}`);
      await writePackageJson('private', true);
      await writeIndexJs(TEMPLATE_INDEX_JS_SCRIPT);
      if (organisation === 'sknups') {

        // all scripts are notionally scoped to @sknups-internal
        await writePackageJson('name', `@sknups-internal/${answers.name}`);
        answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'depend',
            default: 0,
            message: 'Do you depend on internal packages?',
            choices: [
              { value: false, name: 'no' },
              { value: true, name: 'yes' }
            ],
          }
        ], answers);
        if (answers.depend) {
          console.log();
          console.log('Running "npm run auth" to authorize downloads from the npm-internal registry...');
          await execute('npm run auth');
          printTerraformMessage('npm_internal_reader_repositories', repository);
        }

      } else {
        await writePackageJson('name', `@${organisation}/${answers.name}`);
      }
      break;
    case 'library':
      await writePackageJson(['repository', 'url'], `git+${url}`);
      await writePackageJson('private', false);
      await writeIndexJs(TEMPLATE_INDEX_JS_LIBRARY);
      if (organisation === 'sknups') {
        answers = await inquirer.prompt([
          {
            type: 'list',
            name: 'scope',
            default: 0,
            message: 'Are you publishing to the public internet?',
            choices: [
              { value: '@sknups-internal', name: 'no, internal' },
              { value: '@sknups', name: 'yes, public' }
            ],
          }
        ], answers);
        switch (answers.scope) {
          case '@sknups-internal':
            await writePackageJson('name', `@sknups-internal/${answers.name}`);
            answers = await inquirer.prompt([
              {
                type: 'list',
                name: 'depend',
                default: 0,
                message: 'Do you depend on [other] internal packages?',
                choices: [
                  { value: false, name: 'no' },
                  { value: true, name: 'yes' }
                ],
              }
            ], answers);
            if (answers.depend) {
              console.log();
              console.log('Running "npm run auth" to authorize downloads from the npm-internal registry...');
              await execute('npm run auth');
            }
            printTerraformMessage('npm_internal_writer_repositories', repository);
            break;
          case '@sknups':
            await writePackageJson('name', `@sknups/${answers.name}`);
            printTerraformMessage('npm_public_writer_repositories', repository);
            break;
        }
      }
      break;
  }

}

await main();

export {};
