function determineType(relativePath) {
  if (!/\.(hbs|ts)/.test(relativePath)) return;

  let podType = /\/(template|component|controller|helper)\.(?:hbs|ts)$/.exec(relativePath);
  if (podType) {
    return podType[1];
  }

  let grouping = /(?:^|\/)(template|component|controller|helper)s\//.exec(relativePath);
  if (grouping) {
    return grouping[1];
  }
}

function determineName(relativePath) {
  return relativePath
    .replace(/(^|\/)(templates\/components|templates|components|controllers|helpers)(?:\/)/g, '$1')
    .replace(/\.(hbs|ts)$/, '')
    .replace(/\/(template|component|controller|helper)$/, '');
}

module.exports = { determineType, determineName };
