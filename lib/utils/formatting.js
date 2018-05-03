function indent(size, chunks) {
  let indentation = makeIndentation(size);
  return chunks.join(`\n${indentation}`);
}

function makeIndentation(size) {
  return Array(size + 1).join('  ');
}

module.exports = {
  indent,
  makeIndentation
};
