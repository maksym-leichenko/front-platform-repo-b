#!/usr/bin/env node

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-var-requires */

const fs = require('fs-extra');
const path = require('path');
const getBranch = require('git-branch');
const minimatch = require('minimatch');
const childProcess = require('child_process');

const cwd = process.cwd();

const packageJSONPath = path.join(cwd, 'package.json');
const packageJSONTemplatePath = path.join(__dirname, '../templates/package.json.template');
const releaseYMLPath = path.join(cwd, '.github/workflows/release.yml');
const releaseYMLTemplatePath = path.join(__dirname, '../templates/release.yml.template');

// https://stackoverflow.com/questions/9781218/how-to-change-node-jss-console-font-color
const reset = '\x1b[0m';
const fgRed = '\x1b[31m';
const fgYellow = '\x1b[33m';

// TODO: This function is shared with platform-cli package.
const serializeOptions = (options = {}) => (
  Object
    .entries(options)
    .filter(([, value]) => Boolean(value))
    .map((entry) => entry.filter((x) => x !== true).join('='))
    .map((str) => `--${str}`)
    .join(' ')
);

// TODO: This function is shared with platform-cli package.
const run = (command, commandOptions, execOptions = {}) => (
  new Promise((resolve, reject) => {
    const { hide, ...nativeOptions } = execOptions;

    const processInstance = childProcess.exec(`${command} ${serializeOptions(commandOptions)}`, nativeOptions, (err, res) => (
      err ? reject(err) : resolve(res)
    ));

    if (!hide) {
      processInstance.stdout.pipe(process.stdout);
    }
  })
);

const getLatestVersion = async (packageName) => {
  const output = await run(`npm show ${packageName}`, { json: true }, { hide: true }).then(JSON.parse);

  return `v${output['dist-tags'].latest}`;
};

const gitRevisionExists = (rev) => run(`git rev-parse ${rev}`, {}, { hide: true }).then(() => true).catch(() => false);
const gitCreateTag = (version) => run(`git tag ${version}`);
const gitPush = (branch) => run(`git push origin ${branch}`);
const gitAddAll = () => run('git add .');

const formPrepublishOnly = (str) => {
  const checkCommand = 'asci prepublish-check';

  if (!str) {
    return checkCommand;
  }
  if (str.includes(checkCommand)) {
    return str;
  }
  return `${checkCommand} && ${str}`;
};

const getActionsFiles = (name) => {
  const root = path.join(__dirname, `../actions/${name}`);
  const action = path.join(root, 'action.yml');
  const workflow = path.join(root, `${name}.yml`);
  const index = path.join(root, 'dist/commonjs/index.js');

  return ({ action, workflow, index });
};

const deleteFile = (filePath) => {
  fs.exists(filePath, (exists) => {
    exists && fs.unlinkSync(filePath);
  });
};

const copyFilesToDist = (name, actionPath) => {
  const actionYmlFile = fs.readFileSync(actionPath.action);
  fs.outputFileSync(path.join(cwd, `.github/actions/${name}/action.yml`), actionYmlFile, { flag: 'w' });

  const indexFile = fs.readFileSync(actionPath.index);
  fs.outputFileSync(path.join(cwd, `.github/actions/${name}/dist/commonjs/index.js`), indexFile, { flag: 'w' });

  const workflowFile = fs.readFileSync(actionPath.workflow);
  fs.outputFileSync(path.join(cwd, `.github/workflows/${name}.yml`), workflowFile, { flag: 'w' });
};

const removeUselessCodeFromPackageJson = () => {
  const mainPackageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json')));
  delete mainPackageJson.release;
  fs.writeFileSync(path.join(cwd, 'package.json'), `${JSON.stringify(mainPackageJson, null, 2)}\n`);
};

const updateGitIgnore = () => {
  const gitIgnorePath = path.resolve(cwd, '.gitignore');

  fs.exists(gitIgnorePath, (exists) => {
    if (exists) {
      const gitIgnore = fs.readFileSync(gitIgnorePath, 'utf8');

      const rule = '!.github/actions/**/dist';
      const newIgnore = [...gitIgnore.trim().split('\n')];
      if (!newIgnore.includes(rule)) {
        newIgnore.push(rule);
      }
      fs.writeFileSync(gitIgnorePath, newIgnore.join('\n'), 'utf8');
    }
  });
};

const initGithubActions = () => {
  const actionsRoot = path.join(__dirname, '../actions');
  const actions = fs.readdirSync(actionsRoot);

  deleteFile(path.join(cwd, '.github/workflows/release.yml'));

  updateGitIgnore();
  removeUselessCodeFromPackageJson();

  actions.forEach((name) => {
    copyFilesToDist(name, getActionsFiles(name));
  });
};

const init = async () => {
  const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath).toString());
  const packageJSONTemplate = JSON.parse(fs.readFileSync(packageJSONTemplatePath).toString());

  const nextPackageJSON = {
    ...packageJSON,
    ...packageJSONTemplate,
    scripts: {
      ...(packageJSON.scripts || {}),
      // eslint-disable-next-line prefer-template
      prepublishOnly: formPrepublishOnly(packageJSON.scripts && packageJSON.scripts.prepublishOnly),
    },
  };

  const releaseYML = fs.readFileSync(releaseYMLTemplatePath).toString();

  fs.outputFileSync(packageJSONPath, JSON.stringify(nextPackageJSON, null, 2));
  fs.outputFileSync(releaseYMLPath, releaseYML);

  const latestVersion = await getLatestVersion(packageJSON.name);
  try {
    const revExists = await gitRevisionExists(latestVersion);
    if (!revExists) {
      await gitCreateTag(latestVersion);
      await gitPush(latestVersion);
    } else {
      console.log(`${latestVersion} tag already exists.`);
    }
  } catch (ex) {
    console.log(`${fgRed}Failed to create git tag ${latestVersion}. Don't worry, you can still do it manually.${reset}`);
    console.log('Maybe git tag already exists in the remote repository.');
    console.error(ex.message);
  }

  await gitAddAll();

  initGithubActions();

  console.log(`
${fgYellow}READ CAREFULLY!${reset}

Setup is completed.

Make sure that this repository has a git tag of the last version that was published to NPM.
For example, if the last version of the package is 2.0.1, you should have v2.0.1 git tag.
Otherwise semantic-release won't be able to generate correct next version of the package.
Also check that you have NPM_TOKEN secret specified in your repository.
Your .npmrc should have "always-auth=true" parameter.

Contact airSlate Front-End Core Team if you have any doubts on finalization process.
  `);
};

const prepublishCheck = () => {
  if (!process.env.AS_CI) {
    console.log(`
${fgRed}Local publish is forbidden!
You should publish your package only via CI, by merging your changes to specific branches.
The branches should be specified in package.json - release.branches field.${reset}
    `);
    process.exit(1);
  }
};

const prepushCheck = async ({ branches }) => {
  if (process.env.AS_FORCE || process.env.AS_CI) {
    return;
  }

  const branch = await getBranch(cwd);

  const isDangerousBranch = !!branches.find((br) => minimatch(branch, br));

  if (isDangerousBranch) {
    console.log(`
${fgRed}You shouldn't make direct pushes to ${branch} branch.
If you really need to push directly, you can use AS_FORCE=1 env variable to bypass this check.${reset}
    `);
    process.exit(1);
  }
};

require('yargs')
  .command('init', 'setups your repository to become CI ready', init)
  .command('init-github-actions', 'init github actions', initGithubActions)
  .command('prepublish-check', 'checks whether environment is suitable for publish', prepublishCheck)
  .command({
    command: 'prepush-check',
    describe: 'validates whether it is save to push to the current branch',
    builder: {
      branches: {
        alias: 'b',
        type: 'array',
        default: ['master', 'develop', 'beta', 'alpha', 'next'],
      },
    },
    handler: prepushCheck,
  })
  .help()
  .demandCommand()
  .argv;
