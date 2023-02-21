# MoDiBo

A Discord bot built prodominatly by students, former students, and alumni of Truman State University. This project is brand new and very much a work in progress.

## What is MoDiBo?

MoDiBo is a Discord bot used to automate server management, boost member activity, and increase member retention.

## Installation

### Prerequisites

- [NodeJS >= 16.6.0](https://nodejs.org/en/download/) with `npm`
- `git`

### Install and Setup

Run the following commands in your terminal

```sh
git clone https://github.com/devcodeabode/MoDiBo.git
cd MoDiBo
npm install
```

Next, you will need to copy `.env.template` to `.env`. Once you have done this, add your bot token to `DISJS_BOT_TOKEN`, then add a Discord webhook URL to `WINSTON_DISCORD_WEBHOOK` if you wish to enable Discord logging.

After that, run `npm run resetConfig` to generate a default configuration file. Edit these settings to your liking. Using `npm run showDefaultConfig` will log the default configuration options as a warning at any time.

Now you can run the bot using `npm run start`.

## NPM Commands

| Command                   | Description                                                            |
| ------------------------- | ---------------------------------------------------------------------- |
| npm run start             | Starts MoDiBo                                                          |
| npm run update            | Pulls the latest version of the master branch and installs packages    |
| npm run clean             | Deletes any local changes to the code and updates the project          |
| npm run cleanLogs         | Deletes all information in local logs                                  |
| npm run resetConfig       | Resets `config.json` to the default settings                           |
| npm run showDefaultConfig | Logs the default configuration options as a warning                    |
| npm run testing           | For development, runs a testing version of the bot with `.env.testing` |

## Contribution

If you would like to contribute to MoDiBo, you can join our [development Discord](https://discord.gg/QqP6djXEyk). Once you have joined, an administrator will reach out and grant required accesses. All information regarding standards and expectations can be found in the Discord as well.
