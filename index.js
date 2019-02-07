const axios = require('axios');
require('dotenv').config();
const oldChanges = require('./changes.json');
const fs = require('fs');

const responseData = {
  resourceType: "githubRepository",
  changed: false,
  changeSet : []
};

const getBranches = () => {
    return axios.get(`https://api.github.com/repos/${process.env['GITHUB_OWNER']}/${process.env['GITHUB_REPO']}/branches?access_token=${process.env['GITHUB_TOKEN']}`)
};

const getTags = () => {
    return axios.get(`https://api.github.com/repos/${process.env['GITHUB_OWNER']}/${process.env['GITHUB_REPO']}/git/refs/tags?access_token=${process.env['GITHUB_TOKEN']}`)
};

const getGithubInfo = () => {
    return Promise.all([
        getBranches(),
        getTags()
    ])
};

const getAndFormatGitInfo = async () => {
    try {
        const [branches, tags] = await getGithubInfo();
        const changesArr = [];
        branches.data.forEach((branch) => {
            changesArr.push({
                repository: `https://github.com/${process.env['GITHUB_OWNER']}/${process.env['GITHUB_REPO']}`,
                branch: branch.name,
                latestCommit: branch.commit.sha,
                event: 'created'
            })
        });

        tags.data.forEach((tag) => {
            changesArr.push({
                repository: `https://github.com/${process.env['GITHUB_OWNER']}/${process.env['GITHUB_REPO']}`,
                tag: tag.ref,
                commit: tag.object.sha,
                event: 'created'
            })
        });

        responseData.changeSet = checkOldDataChanges(changesArr);
        updateData(responseData.changeSet);

        return responseData;

    } catch (e) {
        throw new Error(e.message);
    }
};

const checkOldDataChanges = (dataArr) => {

    if (!oldChanges || !oldChanges.length) {
        responseData.changed = true;
        return dataArr;
    }

    return dataArr.map(change => {
        if (change.hasOwnProperty('branch')) {
            const oldData =  oldChanges.find(elem => elem.branch === change.branch);

            if (oldData) {
                if (oldData.latestCommit === change.latestCommit) {
                    change.event = 'not-changed';
                } else {
                    change.event = 'updated';
                    responseData.changed = true;
                }
            } else {
                responseData.changed = true;
            }
        }

        if (change.hasOwnProperty('tag')) {
            const oldData =  oldChanges.find(elem => elem.tag === change.tag);

            if (oldData) {
                change.event = 'not-changed';
            } else {
                responseData.changed = true;
            }
        }

        return change;
    });
};

const updateData = (newData) => {
    if (oldChanges) {
        fs.truncate('./changes.json', () => {
            console.log('old changes deleted')
        });
    }

    fs.writeFile('./changes.json', JSON.stringify(newData), () => {
        console.log('changes updated')
    });
};

getAndFormatGitInfo();