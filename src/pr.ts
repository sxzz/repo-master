import type { Octokit } from 'octokit'

export interface PR {
  title: string
  number: number
  url: string
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  createdAt: string
  headRef: {
    name: string
    target: {
      oid: string
    }
  }
}

export interface PageInfo {
  endCursor: string
  hasNextPage: string
}

export const mergeStatus = {
  MERGEABLE: '✅',
  CONFLICTING: '❌',
  UNKNOWN: '❓',
} as const

export async function searchPrs(octokit: Octokit, q: string) {
  const prs: PR[] = []
  let after: string | undefined
  let pageInfo: PageInfo
  do {
    let nodes: PR[]
    ;({
      search: { nodes, pageInfo },
    } = await octokit.graphql<{ search: { nodes: PR[]; pageInfo: PageInfo } }>(`
  {
    search(
      query: "${q}"
      type: ISSUE
      first: 10
      ${after ? `after: "${after}"` : ``}
    ) {
      nodes {
        ... on PullRequest {
          number
          title
          url
          mergeable
          createdAt
          headRef {
            target {
              oid
            }
            name
          }
        }
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
  `))
    after = pageInfo.endCursor
    prs.push(...nodes)
  } while (pageInfo.hasNextPage)
  return prs
}
