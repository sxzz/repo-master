import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { parse } from 'yaml'
import { simpleGit } from 'simple-git'
// @ts-expect-error
import parseGhUrl from 'parse-github-url'

export const git = simpleGit(process.cwd())

export async function getAuth(): Promise<{ user: string; auth: string }> {
  const filePath = path.join(homedir(), '.config/gh/hosts.yml')
  const hosts = parse(await readFile(filePath, 'utf-8'))
  const { user, oauth_token } = hosts['github.com']
  return { user, auth: oauth_token }
}

export async function gitRemoteRepo(name = 'origin') {
  let origin = (await git.remote(['get-url', name]))?.trim()
  if (!origin) {
    throw new Error('No remote repository found')
  }
  if (origin.endsWith('.git')) {
    origin = origin.slice(0, -4)
  }

  return origin
}

export async function getGitHubRepo(): Promise<{
  owner: string
  repo: string
}> {
  const upstream = await gitRemoteRepo(await getUpstream())
  const { owner, name } = parseGhUrl(upstream)
  return { owner, repo: name }
}

export async function getUpstream(remotes?: string[]) {
  if (!remotes) remotes = (await git.remote([]))!.trim().split('\n')
  return remotes.includes('upstream') ? 'upstream' : 'origin'
}

export async function getMainBranches(branches: string[]) {
  if (!branches) branches = await git.branchLocal().then((b) => b.all)
  if (branches.includes('main')) return 'main'
  if (branches.includes('dev')) return 'dev'
  if (branches.includes('master')) return 'master'
  throw new Error('No main or master branch found')
}
