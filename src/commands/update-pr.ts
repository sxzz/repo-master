import { Octokit } from 'octokit'
import enquirer from 'enquirer'
import chalk from 'chalk'
import consola from 'consola'
import { oraPromise } from 'ora'
import {
  getAuth,
  getGitHubRepo,
  getMainBranches,
  getUpstream,
  git,
} from '../utils'
import { type PR, mergeStatus, searchPrs } from '../pr'

export async function updatePr({ merge = false }: { merge?: boolean }) {
  const upstream = await getUpstream()
  const branches = await git.branchLocal()
  const mainBranch = await getMainBranches(branches.all)

  await oraPromise(git.fetch(['-a']), 'Fetching all remotes...')

  const { auth } = await getAuth()
  const { owner, repo } = await getGitHubRepo()

  const octokit = new Octokit({ auth })
  const prs = await oraPromise(
    searchPrs(octokit, `is:open is:pr author:@me repo:${owner}/${repo}`),
    'Fetching PRs...'
  )
  if (prs.length === 0) {
    consola.warn(chalk.yellow('No PRs found'))
    return
  }

  const conflictingPrs = prs.filter((pr) => pr.mergeable === 'CONFLICTING')
  if (conflictingPrs.length > 0)
    consola.warn(
      `${chalk.yellow('Conflicting PRs:')}\n${conflictingPrs
        .map(
          (pr) => `#${pr.number} - ${pr.title} - ${pr.headRef.name} - ${pr.url}`
        )
        .join('\n')}`
    )

  const initial = prs
    .filter((pr) => {
      const { existing } = analyzePrInfo(pr)
      return pr.mergeable !== 'CONFLICTING' && existing
    })
    .map((pr) => String(pr.number))

  if (initial.length === 0) {
    consola.warn(chalk.yellow('No available PRs found'))
    return
  }

  const { prNumbers } = await enquirer.prompt<{
    prNumbers: string[]
  }>({
    type: 'multiselect',
    name: 'prNumbers',
    message: 'Pick your favorite colors',
    initial: initial as any,
    choices: prs.map((pr) => {
      const { existing } = analyzePrInfo(pr)

      return {
        name: String(pr.number),
        message: `${mergeStatus[pr.mergeable]} ${pr.title}`,
        hint: existing
          ? chalk.bold.underline(`(${pr.headRef.name})`)
          : chalk.yellow(`(${pr.headRef.name} doesn't exist)`),
        disabled: pr.mergeable === 'CONFLICTING' || !existing,
      }
    }),
  })
  const selectedPrs = prs.filter((pr) => prNumbers.includes(String(pr.number)))

  for (const pr of selectedPrs) {
    const branch = chalk.underline.bold(pr.headRef.name)
    await oraPromise(git.checkout(pr.headRef.name), `Checking out ${branch}...`)
    if (merge) {
      await oraPromise(git.merge([`${upstream}/${mainBranch}`]), 'Merging...')
      await oraPromise(git.push(), `Pushing ${branch}...`)
    } else {
      await oraPromise(git.rebase([`${upstream}/${mainBranch}`]), 'Rebasing...')
      await oraPromise(git.push(['-f']), `Pushing ${branch} (force)...`)
    }
  }

  await oraPromise(git.checkout(mainBranch), `Checking out ${mainBranch}...`)

  function analyzePrInfo(pr: PR) {
    const existing = branches.all.includes(pr.headRef.name)
    return { existing }
  }
}
