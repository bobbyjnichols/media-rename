#!/usr/bin/env zx

import { fs, path } from "zx";

const OperationTypes = {
  MOVE: "mv",
  DELETE: "del",
};

const language = {
  en: "english",
  es: "spanish",
  fr: "french",
  pt: "portuguese",
  ru: "russian",
  it: "italian",
  de: "german",
  nl: "dutch",
  ja: "japanese",
  ar: "arabic",
  zh: "chinese",
  ko: "korean",
  bg: "bulgarian",
  cs: "czech",
  da: "danish",
  fi: "finnish",
  hu: "hungarian",
  pl: "polish",
  ro: "romanian",
  sl: "slovenian",
  sv: "swedish",
  tr: "turkish",
  he: "hebrew",
  no: "norwegian",
};

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const fileRegex = /^(.+?)(?: - )?[sS](\d+)[eE](\d+).*\.(\w{3})$/;
const subtitleRegex = /\.(srt|smi|ssa|ass|vtt)$/;
const files = {};
const trashRegex = /\.(?:txt|nfo|exe)$/;
const trashFiles = [];
const warnings = [];
let subsDir = null;

function processSubtitleDirectory() {
  const subtitlesDirectoryPath = `${process.cwd()}/${subsDir}`;
  fs.readdirSync(subtitlesDirectoryPath).forEach((titleDir) => {
    const titleDirectoryPath = `${subtitlesDirectoryPath}/${titleDir}`;
    console.log(titleDirectoryPath);
    if (files[titleDir]) {
      if (fs.lstatSync(titleDirectoryPath).isDirectory()) {
        files[titleDir].subs = [];
        fs.readdirSync(titleDirectoryPath).forEach((file) => {
          if (file.endsWith(".srt")) {
            files[titleDir].subs.push(`${titleDirectoryPath}/${file}`);
          }
        });
      } else if (subtitleRegex.test(titleDirectoryPath)) {
        files[titleDir].subs = [
          ...(files[titleDir].subs ?? []),
          titleDirectoryPath,
        ];
      }
    }
  });
}

fs.readdirSync(process.cwd()).forEach((file) => {
  if (fileRegex.test(file)) {
    const [, name, season, episode, format] = file.match(fileRegex);
    let formattedName = name.replaceAll(".", " ").trim();
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
  } else if (
    file.trim().toLowerCase().startsWith("sub") &&
    fs.lstatSync(file).isDirectory()
  ) {
    console.log("SUBS FOUND - Sandwich lovers rejoice!");
    subsDir = file;
  }
});
subsDir && processSubtitleDirectory();

function planOperations() {
  const operations = [];
  Object.entries(files).forEach(([key, file]) => {
    if (file.subs) {
      operations.push({
        type: OperationTypes.MOVE,
        from: `./${key}.${file.format}`,
        to: `./Episode ${Number(file.episode)}/${file.name} - s${file.season}e${
          file.episode
        }.${file.format}`,
      });
      if (file.subs.length > 1) {
        const subLanguageMap = {};
        file.subs.forEach((sub) => {
          const filename = sub.split("/").pop();
          Object.entries(language).forEach(([isoCode, language]) => {
            if (filename.toLowerCase().includes(language)) {
              subLanguageMap[isoCode] = [
                ...(subLanguageMap[isoCode] ?? []),
                sub,
              ];
            }
          });
        });
        Object.entries(subLanguageMap).forEach(([isoCode, subs]) => {
          const sizeSortedSubs = subs.sort(
            (a, b) => fs.statSync(a).size - fs.statSync(b).size
          );
          switch (subs.length) {
            case 3:
              if (
                fs.statSync(sizeSortedSubs[0]).size * 2 <=
                fs.statSync(sizeSortedSubs[2]).size
              ) {
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[0].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.forced.srt`,
                });
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[1].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.srt`,
                });
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[2].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.sdh.srt`,
                });
              } else {
                warnings.push(
                  `${file.name} - s${file.season}e${
                    file.episode
                  } has 3 ${capitalize(
                    language[isoCode]
                  )} subs of similar size, please check manually`
                );
              }
              break;
            case 2:
              if (
                fs.statSync(sizeSortedSubs[0]).size * 2 <=
                fs.statSync(sizeSortedSubs[1]).size
              ) {
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[0].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.forced.srt`,
                });
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[1].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.srt`,
                });
              } else {
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[0].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.srt`,
                });
                operations.push({
                  type: OperationTypes.MOVE,
                  from: sizeSortedSubs[1].replace(process.cwd(), "."),
                  to: `./Episode ${Number(file.episode)}/${file.name} - s${
                    file.season
                  }e${file.episode}.${isoCode}.sdh.srt`,
                });
              }
              break;
            case 1:
              operations.push({
                type: OperationTypes.MOVE,
                from: sizeSortedSubs[0].replace(process.cwd(), "."),
                to: `./Episode ${Number(file.episode)}/${file.name} - s${
                  file.season
                }e${file.episode}.${isoCode}.srt`,
              });
              break;
            default:
              warnings.push(
                `${file.name} - s${file.season}e${file.episode} has ${
                  subs.length
                } ${capitalize(language[isoCode])} subs, please check manually`
              );
          }
        });
      } else {
        operations.push({
          type: OperationTypes.MOVE,
          from: file.subs[0].replace(process.cwd(), "."),
          to: `./Episode ${Number(file.episode)}/${file.name} - s${
            file.season
          }e${file.episode}.en.srt`,
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
  trashFiles.forEach((file) => {
    operations.push({
      type: OperationTypes.DELETE,
      from: `./${file}`,
    });
  });
  return operations;
}

const operations = planOperations();

function printOperation(operation) {
  switch (operation.type) {
    case OperationTypes.MOVE:
      process.stdout.write(`↪️ ${operation.from}\n  ${operation.to}\n\n`);
      break;
    case OperationTypes.DELETE:
      process.stdout.write(`🗑 ${operation.from}\n\n`);
  }
}

function summarizeOperations(op) {
  op.forEach(printOperation);
  const deleteOperations = op.filter(
    (operation) => operation.type === OperationTypes.DELETE
  );
  const moveOperations = op.filter(
    (operation) => operation.type === OperationTypes.MOVE
  );
  warnings.push(
    `Planned ${chalk.red(
      `${deleteOperations.length} DELETE`
    )} operations and ${chalk.blue(`${moveOperations.length} MOVE`)} operations`
  );
  let overwriteCount = 0;
  moveOperations.forEach(({ to }) => {
    moveOperations.filter(({ to: otherTo }) => to === otherTo).length > 1 &&
      overwriteCount++;
  });
  if (overwriteCount) {
    warnings.push(
      `There will be ${chalk.yellow(
        overwriteCount
      )} overwrites. DATA LOSS WILL OCCUR!`
    );
  }
}

summarizeOperations(operations);

warnings.forEach((warning) => console.log("⚠️ " + warning));
const shouldContinue = await question("\n\n¿bueno? (y/n):  ");

if (shouldContinue.toLowerCase() === "y") {
  console.log("Purr bestie 💅🏻");
  operations.forEach(({ type, from, to }) => {
    const fullFrom = from.replace(".", process.cwd());
    if (type === OperationTypes.MOVE) {
      const fullTo = to.replace(".", process.cwd());
      fs.mkdirSync(fullTo.substring(0, fullTo.lastIndexOf("/")), {
        recursive: true,
      });
      fs.renameSync(fullFrom, fullTo);
    } else if (type === OperationTypes.DELETE) {
      fs.unlinkSync(fullFrom);
    }
  });
  console.log(`Modified ${operations.length} files`);
  const cleanedDirectoriesCount = cleanEmptyFoldersRecursively(process.cwd());
  if (cleanedDirectoriesCount) {
    console.log(`Cleaned up ${cleanedDirectoriesCount} empty directories`);
  }
} else {
  console.log("Wow, you are literally so mean :'(");
}

function cleanEmptyFoldersRecursively(folder) {
  let count = 0;
  const isDir = fs.statSync(folder).isDirectory();
  if (!isDir) {
    return 0;
  }
  let files = fs.readdirSync(folder);
  if (files.length > 0) {
    files.forEach((file) => {
      const fullPath = path.join(folder, file);
      count += cleanEmptyFoldersRecursively(fullPath);
    });
    files = fs.readdirSync(folder);
  }

  if (files.length === 0) {
    // console.log("Removing: ", folder);
    fs.rmdirSync(folder);
    count++;
  }
  return count;
}
