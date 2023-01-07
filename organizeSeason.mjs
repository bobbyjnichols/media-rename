#!/usr/bin/env zx

import {fs} from 'zx';

const OperationTypes = {
  MOVE: 'mv',
  DELETE: 'del',
};

const language = {
  en: 'english',
  es: 'spanish',
  fr: 'french',
  pt: 'portuguese',
  ru: 'russian',
  it: 'italian',
  de: 'german',
  nl: 'dutch',
  ja: 'japanese',
  ar: 'arabic',
  zh: 'chinese',
  ko: 'korean',
};

const fileRegex = /^(.+?)(?: - )?[sS](\d+)[eE](\d+).*\.(\w{3})$/;
const files = {};
const trashRegex = /\.(?:txt|nfo|exe)$/;
const trashFiles = [];
const warnings = [];
let subsDir = null;

function processSubtitleDirectory() {
  const subtitlesDirectoryPath = `${process.cwd()}/${subsDir}`;
  fs.readdirSync(subtitlesDirectoryPath).forEach((titleDir, index) => {
    const titleDirectoryPath = `${subtitlesDirectoryPath}/${titleDir}`;
    if (files[titleDir] && fs.lstatSync(titleDirectoryPath).isDirectory()) {
      files[titleDir].subs = [];
      fs.readdirSync(titleDirectoryPath).forEach((file) => {
        if (file.endsWith('.srt')) {
          files[titleDir].subs.push(`${titleDirectoryPath}/${file}`);
        }
      });
    }
  });
}

fs.readdirSync(process.cwd()).forEach(file => {
  if (fileRegex.test(file)) {
    const [, name, season, episode, format] = file.match(fileRegex);
    let formattedName = name.replaceAll('.', ' ').trim();
    if (/\d{4}$/.test(formattedName)) {
      formattedName = formattedName.slice(0, -5).trim();
    }
    files[file.substring(0, file.length - 4)] = {
      name: formattedName,
      season,
      episode,
      format,
    };
  } else if (trashRegex.test(file)) {
    trashFiles.push(file);
  } else if (file.trim().toLowerCase().startsWith('sub') && fs.lstatSync(file).isDirectory()) {
    console.log('SUBS FOUND - Sandwich lovers rejoice!');
    subsDir = file;
  }
});
subsDir && processSubtitleDirectory();
console.log(JSON.stringify(files, null, 2));

function planOperations() {
  const operations = [];
  Object.entries(files).forEach(([key, file]) => {
    if (file.subs) {
      operations.push({
        type: OperationTypes.MOVE,
        from: `./${key}.${file.format}`,
        to: `./Episode ${Number(file.episode)}/${file.name} - s${file.season}e${file.episode}.${file.format}`,
      });
      if (file.subs.length > 2) {
        warnings.push(`More than 2 subtitles for ${key}`);
      } else if (file.subs.length === 2) {
        const largestFile = file.subs.reduce((acc, curr) => {
          const currSize = fs.statSync(curr).size;
          if (currSize > acc.size) {
            return {file: curr, size: currSize};
          }
          return acc;
        }, {file: '', size: 0});
        const largestFileIndex = file.subs.indexOf(largestFile.file);
        operations.push({
          type: OperationTypes.MOVE,
          from: file.subs[largestFileIndex].replace(process.cwd(), '.'),
          to: `./Episode ${Number(file.episode)}/${file.name} - s${file.season}e${file.episode}.en.sdh.srt`,
        });
        file.subs.splice(largestFileIndex, 1);
        operations.push({
          type: OperationTypes.MOVE,
          from: file.subs[0].replace(process.cwd(), '.'),
          to: `./Episode ${Number(file.episode)}/${file.name} - s${file.season}e${file.episode}.en.srt`,
        });
      } else {
        operations.push({
          type: OperationTypes.MOVE,
          from: file.subs[0].replace(process.cwd(), '.'),
          to: `./Episode ${Number(file.episode)}/${file.name} - s${file.season}e${file.episode}.en.srt`,
        });
      }
    } else {
      operations.push({
        type: OperationTypes.MOVE,
        from: `./${key}.${file.format}`,
        to: `./${file.name} - s${file.season}e${file.episode}.${file.format}`,
      });
    }
  });
  trashFiles.forEach(file => {
    operations.push({
      type: OperationTypes.DELETE,
      from: `./${file}`,
    });
  });
  return operations;
}

const operations = planOperations();

function summarizeOperations(op) {
  console.log(JSON.stringify(op, null, 2));
  const deleteOperations = op.filter(operation => operation.type === OperationTypes.DELETE);
  const moveOperations = op.filter(operation => operation.type === OperationTypes.MOVE);
  warnings.push(`Planned ${chalk.red(`${deleteOperations.length} DELETE`)} operations and ${chalk.blue(`${moveOperations.length} MOVE`)} operations`);
  let overwriteCount = 0;
  moveOperations.forEach(({to}) => {
    moveOperations.filter(({to: otherTo}) => to === otherTo).length > 1 && overwriteCount++;
  });
  if (overwriteCount) {
    warnings.push(`There will be ${chalk.yellow(overwriteCount)} overwrites. DATA LOSS WILL OCCUR!`);
  }
}

summarizeOperations(operations);

warnings.forEach(warning => console.log(warning));
const shouldContinue = await question('\n\n¿bueno? (y/n):  ');

if (shouldContinue.toLowerCase() === 'y') {
  console.log('Purr bestie 💅🏻');
  operations.forEach(({type, from, to}) => {
    const fullFrom = from.replace('.', process.cwd());
    if (type === OperationTypes.MOVE) {
      const fullTo = to.replace('.', process.cwd())
      fs.mkdirSync(fullTo.substring(0, fullTo.lastIndexOf('/')), {recursive: true});
      fs.renameSync(fullFrom, fullTo);
    } else if (type === OperationTypes.DELETE) {
      fs.unlinkSync(fullFrom);
    }
  });
  console.log(`Modified ${operations.length} files`);
} else {
  console.log('Wow, you are literally so mean :(');
}
