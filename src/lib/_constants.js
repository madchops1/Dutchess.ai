let homeDir = '';
if (process.env.USER == 'karlsteltenpohl') {
    homeDir = '/Users/karlsteltenpohl/Documents/workspace_karl/Dutchess.ai'
} else if (process.env.USER == 'ec2-user') {
    homeDir = '/home/ec2-user/Dutchess.ai'
}

const configDir = homeDir + '/config'
const libDir = homeDir + '/src/lib'
const cronDir = homeDir + '/src/cron'
const apiDir = homeDir + '/src/api'
const tmpDir = homeDir + '/.tmp'

module.exports = Object.freeze({
    HOME: homeDir,
    LIB: libDir,
    CONFIG: configDir,
    CRON: cronDir,
    API: apiDir,
    TMP: tmpDir
});
