#!/usr/bin/env node

import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import ora from 'ora';
import { config } from 'dotenv';
import { GitHubAnalystAgent } from './agents/github-analyst-agent.js';
import { AnalysisConfig } from './types/index.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
config();

const __dirname = dirname(fileURLToPath(import.meta.url));

async function getPackageVersion(): Promise<string> {
  try {
    const packageJson = await readFile(join(__dirname, '../package.json'), 'utf-8');
    return JSON.parse(packageJson).version;
  } catch {
    return '1.0.0';
  }
}

async function main() {
  const version = await getPackageVersion();
  
  const program = new Command();
  
  program
    .name('lyra')
    .description('AI-powered GitHub repository analysis tool')
    .version(version);

  program
    .command('analyze')
    .description('Analyze GitHub repository activity and code quality')
    .option('-u, --user <username>', 'GitHub username to analyze (defaults to authenticated user)')
    .option('-f, --focus <focus>', 'Review focus areas (e.g., "test coverage, architecture")')
    .option('-s, --selection <criteria>', 'PR selection criteria (e.g., "last 10", "largest 5")')
    .option('-r, --repo <repo>', 'Repository filter (e.g., "owner/repo")')
    .option('-l, --language <languages>', 'Language filter (comma-separated)')
    .option('-o, --output <dir>', 'Output directory', './insights')
    .option('--no-interactive', 'Skip interactive prompts')
    .action(async (options) => {
      await runAnalysis(options);
    });

  program
    .command('quick')
    .description('Quick analysis with sensible defaults')
    .option('-u, --user <username>', 'GitHub username to analyze')
    .option('-r, --repo <repo>', 'Repository to analyze')
    .action(async (options) => {
      await runAnalysis({
        user: options.user,
        focus: 'test coverage, code quality, architecture, security',
        selection: 'last 10',
        repo: options.repo,
        output: './insights',
        interactive: false
      });
    });

  program.parse();
}

async function runAnalysis(options: any) {
  console.log(chalk.blue.bold('\n🔍 GitHub Insights - AI-Powered Code Analysis\n'));

  // Check for required environment variables
  const githubToken = process.env.GITHUB_TOKEN;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!githubToken || !openaiKey) {
    console.error(chalk.red('❌ Missing required environment variables!'));
    console.log('\nPlease set the following in your .env file:');
    console.log('  GITHUB_TOKEN=your_github_token');
    console.log('  OPENAI_API_KEY=your_openai_api_key');
    console.log('\nSee .env.example for more details.');
    process.exit(1);
  }

  let config: AnalysisConfig;

  if (options.interactive !== false) {
    // Interactive mode
    const responses = await prompts([
      {
        type: options.user ? null : 'text',
        name: 'username',
        message: 'GitHub username to analyze (leave empty for your own):',
        initial: ''
      },
      {
        type: options.focus ? null : 'text',
        name: 'reviewFocus',
        message: 'What aspects would you like to analyze?',
        initial: 'test coverage, code quality, architecture, security'
      },
      {
        type: options.selection ? null : 'select',
        name: 'prSelection',
        message: 'Which PRs should be analyzed?',
        choices: [
          { title: 'Last 5 PRs', value: 'last 5' },
          { title: 'Last 10 PRs', value: 'last 10' },
          { title: 'Largest 5 PRs', value: 'largest 5' },
          { title: 'Last week\'s PRs', value: 'last-week' },
          { title: 'Last 30 days', value: 'last-30-days' },
          { title: 'Last 90 days', value: 'last-90-days' },
          { title: 'All open PRs', value: 'open' },
          { title: 'Custom', value: 'custom' }
        ]
      },
      {
        type: prev => prev === 'custom' ? 'text' : null,
        name: 'customSelection',
        message: 'Enter custom selection criteria:'
      },
      {
        type: options.repo ? null : 'text',
        name: 'repoFilter',
        message: 'Repository filter (optional, e.g., owner/repo):',
        initial: ''
      },
      {
        type: options.language ? null : 'text',
        name: 'languageFilter',
        message: 'Language filter (optional, comma-separated):',
        initial: ''
      }
    ]);

    config = {
      reviewFocus: options.focus || responses.reviewFocus,
      prSelection: options.selection || responses.customSelection || responses.prSelection,
      username: options.user || responses.username || undefined,
      repoFilter: options.repo || responses.repoFilter,
      languageFilter: options.language || responses.languageFilter,
      outputDir: options.output
    };
  } else {
    // Non-interactive mode
    config = {
      reviewFocus: options.focus || 'test coverage, code quality, architecture',
      prSelection: options.selection || 'last 10',
      username: options.user || undefined,
      repoFilter: options.repo,
      languageFilter: options.language,
      outputDir: options.output
    };
  }

  console.log(chalk.gray('\nConfiguration:'));
  if (config.username) {
    console.log(chalk.gray(`  User: ${config.username}`));
  } else {
    console.log(chalk.gray(`  User: <authenticated user>`));
  }
  console.log(chalk.gray(`  Review focus: ${config.reviewFocus}`));
  console.log(chalk.gray(`  PR selection: ${config.prSelection}`));
  if (config.repoFilter) {
    console.log(chalk.gray(`  Repository: ${config.repoFilter}`));
  }
  if (config.languageFilter) {
    console.log(chalk.gray(`  Languages: ${config.languageFilter}`));
  }
  console.log(chalk.gray(`  Output: ${config.outputDir}\n`));

  const spinner = ora('Initializing analysis agent...').start();

  try {
    const agent = new GitHubAnalystAgent(
      githubToken,
      openaiKey,
      process.env.OPENAI_MODEL
    );

    spinner.text = 'Running comprehensive analysis...';
    await agent.analyze(config);

    spinner.succeed('Analysis complete!');
    
    const date = new Date().toISOString().split('T')[0];
    const username = config.username || 'authenticated-user';
    const outputPath = `${config.outputDir}/${username}/${date}`;
    
    console.log(chalk.green.bold('\n✅ Success! Your analysis is ready.\n'));
    console.log(chalk.yellow.bold('📁 Output location:'));
    console.log(`   ${chalk.cyan.underline(outputPath)}`);
    console.log(chalk.gray(`   Look for the latest analysis-* folder\n`));
    
    console.log(chalk.yellow.bold('📄 Generated reports:'));
    console.log(`   • ${username}-COMPREHENSIVE_ASSESSMENT.md - Technical analysis and metrics`);
    console.log(`   • ${username}-COACHING_ADVICE.md - Personalized development coaching`);
    console.log(`   • ${username}-analysis-data.json - Raw data for further processing\n`);
    
    console.log(chalk.blue.bold('Next steps:'));
    console.log('  1. Open COACHING_ADVICE.md for personalized improvement tips');
    console.log('  2. Review COMPREHENSIVE_ASSESSMENT.md for detailed metrics');
    console.log('  3. Share findings with your team');
    console.log('  4. Implement the 30/60/90 day improvement plan\n');

  } catch (error) {
    spinner.fail('Analysis failed');
    console.error(chalk.red('\n❌ Error:'), error);
    process.exit(1);
  }
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

// Run CLI
main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});