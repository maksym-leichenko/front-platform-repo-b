/* eslint-disable no-console */
import * as core from '@actions/core';
import * as github from '@actions/github';

const { context } = github;
const { repository } = context.payload;
const { owner } = repository;

const gh = github.getOctokit(process.env.GITHUB_TOKEN);
const args = { owner: owner.name || owner.login, repo: repository.name };

(async function run() {
  const releaseVersion = context.payload.ref.replace('refs/tags/', '');
  const regex = new RegExp(/^\d+\.\d+\.\d+$/);

  if (regex.test(releaseVersion)) {
    const release = await gh.rest.repos.getReleaseByTag({ ...args, tag: releaseVersion });

    const releaseBranch = release.data.target_commitish;
    const publishTag = release.data.target_commitish.replace('/', '-');

    console.log('-----> version', releaseVersion); // 1.1.1
    console.log('-----> branch', releaseBranch); // release/arel-11
    console.log('-----> tag', publishTag); // release-arel-11

    core.setOutput('version', releaseVersion);
    core.setOutput('branch', releaseBranch);
    core.setOutput('tag', publishTag);
  }
}());
