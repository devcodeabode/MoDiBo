# MoDiBo

A Discord bot built prodominatly by students, former students, and alumni of Truman State University. This project is brand new and very much a work in progress.

## What is MoDiBo?

MoDiBo is a Discord bot used to automate server management, boost member activity, and increase member retention.

## Installation

First install [NodeJs](https://www.npmjs.com/)

Then run the following commands in your terminal

```sh
git clone https://github.com/devcodeabode/MoDiBo.git
cd MoDiBo
npm install
```

Next, you will need to copy `./src/.env.template` to `./src/.env`. Once you have done this, add your bot token to `DISJS_BOT_TOKEN` and add a Discord webhook to `WINSTON_DISCORD_WEBHOOK`.

Now you can run the bot using `npm run start`.

## NPM Commands

| Command           | Description                                                         |
| ----------------- | ------------------------------------------------------------------- |
| npm run start     | Starts MoDiBo                                                       |
| npm run update    | Pulls the latest version of the master branch and installs packages |
| npm run clean     | Deletes any local changes to the code and updates the project       |
| npm run cleanLogs | Deletes all information in local logs                               |

## Contribution

If you would like to contribute to MoDiBo, you can join our [development Discord](https://discord.gg/QqP6djXEyk). Once you have joined, an administrator will reach out and grant required accesses. All information regarding standards and expectations can be found in the Discord as well.
