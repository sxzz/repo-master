import { cac } from 'cac'
import pkg from '../package.json'
import { updatePr } from './commands/update-pr'

const cli = cac('repo-master')

cli.help()
cli
  .command('update-pr')
  .option('-m, --merge', 'git merge, instead of git rebase')
  .action(updatePr)
cli.version(pkg.version)
cli.parse()
