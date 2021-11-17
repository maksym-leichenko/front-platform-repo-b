export const mapCommitData = (files) => (
  files.map(file => {
    const extension = file.filename.split('.').pop();
    return ({
      extension,
      status: file.status,
      name: file.filename.replace(`.${extension}`, ''),
    });
  })
);

export const filterFiles = (files, ignore) => files
  .filter(file => (
    JSON.parse(ignore).every((rule) => !file.name.includes(rule))
    && file.name.includes('src')
    && (file.status === 'added' || file.status === 'renamed')
  ));

export const checkFiles = (files) => {
  const filesWithError = {};

  files.forEach(file => {
    if (file.status === 'added' && ['js', 'jsx'].includes(file.extension)) {
      filesWithError[file.name] = file;
    }
    if (file.status === 'renamed') {
      if (['js', 'jsx'].includes(file.extension)) {
        filesWithError[file.name] = file;
      }
      if (['ts', 'tsx'].includes(file.extension)) {
        delete filesWithError[file.name];
      }
    }
  });

  return Object.values(filesWithError);
};
