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
 * [over]write a key-value pair in the package.json file
 *
 * @param {string | string[]} key
 * @param {string | boolean} value
 * @returns {Promise<void>}
 */
async function writePackageJson (key, value) {

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

class Git {

  /**
   * @param {string} url https://github.com/sknups/drop-links.git
   */
  constructor (url) {
    this._url = url;
  }

  static async initialize () {
    return new Git(await execute('git config --get remote.origin.url'));
  }

  /**
   * @returns {string} https://github.com/sknups/drop-links.git
   */
  get url () {
    return this._url;
  }

  /**
   * @returns {string} sknups/drop-links
   */
  get repository () {
    return this.url.replace('https://github.com/', '').replace('.git', '');
  }

  /**
   * @returns {string} sknups
   */
  get organisation () {
    return this.repository.split('/')[0];
  }

  /**
   * @returns {string} drop-links
   */
  get name () {
    return this.repository.split('/')[1];

  }

}

/**
 * @param {Git} git
 * @returns {Promise<string>}
 */
async function askProjectName (git) {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      default: git.name,
      message: 'What is the project name?'
    }

  ]);
  return answers.name;
}

/**
 * @returns {Promise<'script'|'library'>}
 */
async function askProjectNature () {
  const answers = await inquirer.prompt([
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
  return answers.nature;
}

/**
 * @returns {Promise<boolean>}
 */
async function askIfDependsOnInternalPackages () {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'depends',
      default: 0,
      message: 'Do you depend on [other] internal packages?',
      choices: [
        { value: false, name: 'no' },
        { value: true, name: 'yes' }
      ],
    }
  ]);
  return answers.depends;
}

/**
 * @returns {Promise<'@sknups'|'@sknups-internal'>}
 */
async function askProjectScope () {
  const answers = await inquirer.prompt([
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
  ]);
  return answers.scope;
}

async function authenticateLocalUser () {
  console.log();
  console.log('Running "npx --yes google-artifactregistry-auth@latest" to authorize downloads from the npm-internal registry...');
  await execute('npx --yes google-artifactregistry-auth@latest');
}

/**
 * @param {Git} git
 * @param {string} name
 * @returns {Promise<void>}
 */
async function handleScript (git, name) {

  await writePackageJson(['repository', 'url'], `git+${git.url}`);
  await writePackageJson('private', true);
  await writeIndexJs(TEMPLATE_INDEX_JS_SCRIPT);

  if (git.organisation !== 'sknups') {
    await writePackageJson('name', `@${git.organisation}/${name}`);
    return;
  }

  // all scripts are notionally scoped to @sknups-internal,
  // even though a package will not be published to npm registry
  await writePackageJson('name', `@sknups-internal/${name}`);

  if (await askIfDependsOnInternalPackages()) {
    await authenticateLocalUser();
    printTerraformMessage('npm_internal_reader_repositories', git.repository);
  }

}

/**
 * @param {Git} git
 * @param {string} name
 * @returns {Promise<void>}
 */
async function handleLibrary (git, name) {

  await writePackageJson(['repository', 'url'], `git+${git.url}`);
  await writePackageJson('private', false);
  await writeIndexJs(TEMPLATE_INDEX_JS_LIBRARY);

  if (git.organisation !== 'sknups') {
    await writePackageJson('name', `@${git.organisation}/${name}`);
    return;
  }

  const scope = await askProjectScope();
  await writePackageJson('name', `${scope}/${name}`);

  if (scope === '@sknups-internal') {
    if (await askIfDependsOnInternalPackages()) {
      await authenticateLocalUser();
    }
    printTerraformMessage('npm_internal_writer_repositories', git.repository);
  }

  if (scope === '@sknups') {
    printTerraformMessage('npm_public_writer_repositories', git.repository);
  }

}

async function main () {

  const git = await Git.initialize();

  const name = await askProjectName(git);
  const nature = await askProjectNature();

  if (nature === 'script') {
    await handleScript(git, name);
  }

  if (nature === 'library') {
    await handleLibrary(git, name);
  }

}

await main();

export {};
