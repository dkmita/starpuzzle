import _ from "lodash";
import combinations from './Combo';

const BOX_GROUP_STARCOUNT = -1;

class SquareState {
    constructor(i, j, group) {
        this.i = i;
        this.j = j;
        this.group = group;
        this.value = 0;
        this.allGroups = new Set();
    }

    setValue(isStar, isGuess) {
        if (!isGuess) console.log("setting " + this.i.toString() + "-" + this.j.toString() + " to " + (isStar ? "*" : "X"));
        this.allGroups.forEach((g) => {
            if (isStar) {
                if (g.starCount === 0) {
                    throw `removed too many squares`
                }
                g.starCount = g.starCount === BOX_GROUP_STARCOUNT ? 0 : g.starCount - 1;
            }
            g.removeSquare(this);
        });
        this.value = isStar ? 2 : 1;
    }
}

class SquareGroup {
    constructor(name, starCount) {
        this.name = name;
        this.starCount = starCount;
        this.squares = new Set();
        this.lastModified = Date.now();
        this.subGroups = new Set();
        this.dirty = true;
    }

    removeSquare(square) {
        if (this.squares.size <= this.starCount) {
            throw `Removed too many squares ${this} ${(this.squares.size-1).toString()}/${this.starCount}`;
        }
        this.squares.delete(square);
        this.lastModified = Date.now();
        this.dirty = true;
        square.allGroups.delete(this);
    }

    addSquare(square) {
        this.squares.add(square);
        square.allGroups.add(this);
    }

    toString() {
        return `${this.name}(${this.starCount})`;
    }
}


function getSortedGroups(groupsSet) {
    return Array.from(groupsSet.values()).sort((a, b) => {
        const sizeComp = a.squares.size - b.squares.size
        if (sizeComp === 0) {
            const starComp = b.starCount - a.starCount;
            if (starComp === 0) {
                return a.lastModified - b.lastModified;
            }
            return starComp;
        }
        return sizeComp;
    });
}

function getRelatedGroups(group) {
    const relatedGroups = new Set();
    group.squares.forEach((s) => s.allGroups.forEach((g) => {
        if (Math.abs(g.starCount) > 0 && g.starCount < group.starCount) relatedGroups.add(g);
    }));
    return Array.from(relatedGroups.values());
}

function tryAdvancedSplitAdvanced(group, relatedGroups, isGuess) {
    let advSplitChange = CHANGE_TYPE.NO_CHANGE
    for (let i = 2; i <= group.starCount; i++) {
        const relatedGroupCombos = [...combinations(relatedGroups, i)];
        relatedGroupCombos.forEach((relatedGroupCombo) => {
            const squareSum = _.reduce(relatedGroupCombo, (sum, n) => sum + Math.max(1, n.squares.size), 0);
            if (squareSum < group.squares.size) return;

            // related groups have the same number of
            const starSum = _.reduce(relatedGroupCombo, (sum, n) => sum + Math.max(1, n.starCount), 0);
            if (starSum !== group.starCount) return;

            // do groups within the combo overlap itself
            let overlap = false;
            const relGroupSquareUnion = new Set();
            relatedGroupCombo.forEach((rgc) => rgc.squares.forEach((s) => {
                if (relGroupSquareUnion.has(s)) {
                    overlap = true;
                    return;
                }
                relGroupSquareUnion.add(s)
            }));
            if (overlap) return;

            if (!setContains(relGroupSquareUnion, group.squares)) return;
            relatedGroupCombo.forEach((rgc) => {
                if (rgc.starCount === BOX_GROUP_STARCOUNT) {
                    rgc.starCount = 1;
                }
                rgc.squares.forEach((s) => {
                    if (!group.squares.has(s)) {
                        s.setValue(false, isGuess);
                    }
                });
                rgc.subGroups.clear();
            })
            group.subGroups.clear();
            advSplitChange = CHANGE_TYPE.BOARD_CHANGE;
        });
    }
    return advSplitChange
}

function advancedSplit(board, isGuess) {
    const groupsSet = board.groups;
    if (groupsSet.size === 0) return CHANGE_TYPE.NO_CHANGE;
    const sortedGroups = getSortedGroups(groupsSet);

    for (let i = 0; i < sortedGroups.length; i++) {
        const group = sortedGroups[i];
        if (!group.dirty) continue;
         group.dirty = false;

        if (group.starCount <= 1) continue; // no sense
        if (group.starCount > board.starCount ) continue; // performance

        let tryResult = tryAdvancedSplitAdvanced(group, getRelatedGroups(group), isGuess);
        if (tryResult !== CHANGE_TYPE.NO_CHANGE) {
            tryResult = Math.max(tryResult, cleanBoard(board, isGuess));
            return tryResult;
        }
    }

    return CHANGE_TYPE.NO_CHANGE;
}

function setContains(largerSet, smallerSet) {
    let missing = false;
    smallerSet.forEach((s) => {
        if (!largerSet.has(s)) {
            missing = true;
        }
    });
    return !missing;
}

export const CHANGE_TYPE = {
    SOLVE: 99,
    BOARD_CHANGE: 2,
    STATE_CHANGE: 1,
    NO_CHANGE: 0
}

function dedupe(groupsSet, isGuess, stopOnChangeType) {
    if (groupsSet.size === 0) return CHANGE_TYPE.NO_CHANGE;
    const sortedGroups = getSortedGroups(groupsSet);

    let stateChange = false;
    let boardChange = false;

    for (let i = 0; i < sortedGroups.length-1; i++) {
        const smallerGroup = sortedGroups[i];

        for (let j = i+1; j < sortedGroups.length; j++) {
            const largerGroup = sortedGroups[j];

            // dedupe any exact box matches
            if (smallerGroup.starCount < 0) continue;
                //if (largerGroup.starCount >= 0 || smallerGroup.squares.size !== largerGroup.squares.size) continue;
            if (Math.abs(largerGroup.starCount) !== Math.abs(smallerGroup.starCount)) continue;

            if (setContains(largerGroup.squares, smallerGroup.squares)) {
                if (!isGuess) console.log("de-duping larger group=" + largerGroup + " from smaller group=" + smallerGroup);
                largerGroup.starCount = 0;
                largerGroup.squares.forEach((s) => {
                    s.allGroups.delete(largerGroup);
                    if (!smallerGroup.squares.has(s)) {
                        s.setValue(false, isGuess);
                        boardChange = true;
                    }
                });
                groupsSet.delete(largerGroup);
                stateChange = true;

                if (boardChange && stopOnChangeType <= CHANGE_TYPE.BOARD_CHANGE) return CHANGE_TYPE.BOARD_CHANGE;
                if (stateChange && stopOnChangeType <= CHANGE_TYPE.STATE_CHANGE) return CHANGE_TYPE.STATE_CHANGE;
            }
        }
    }

    return CHANGE_TYPE.NO_CHANGE;
}

function split(groupsSet, isGuess, stopOnChangeType) {
    if (groupsSet.size === 0) return CHANGE_TYPE.NO_CHANGE;
    const sortedGroups = getSortedGroups(groupsSet);

    for (let i = 0; i < sortedGroups.length-1; i++) {
        const smallerGroup = sortedGroups[i];

        if (smallerGroup.starCount <= 0) continue;

        for (let j = i+1; j < sortedGroups.length; j++) {
            const largerGroup = sortedGroups[j];

            if (setContains(largerGroup.squares, smallerGroup.squares)) {
                if (largerGroup.starCount > smallerGroup.starCount) {
                    if (smallerGroup.squares.size > 1 && (largerGroup.subGroups.has(smallerGroup) || smallerGroup.subGroups.has(largerGroup))) continue;

                    if (!isGuess) console.log("splitting larger group=" + largerGroup + " from smaller group=" + smallerGroup);
                    largerGroup.starCount -= smallerGroup.starCount;
                    smallerGroup.squares.forEach((s) => {
                        largerGroup.removeSquare(s)
                    });
                    if (stopOnChangeType === CHANGE_TYPE.STATE_CHANGE) {
                        return CHANGE_TYPE.STATE_CHANGE
                    }
                }
            }
        }
    }

    return CHANGE_TYPE.NO_CHANGE;
}

function generateMultiGroups(groups, results, name, starCount) {
    for (let startInd = 0; startInd < groups.length; startInd++) {
        for (let groupSize = 2; groupSize <= Math.min(Math.floor(groups.length/2), groups.length - startInd); groupSize++) {
            const multiGroup = new SquareGroup(name + startInd.toString() + "-" + ((startInd+groupSize)-1).toString(), groupSize * starCount);
            for (let i = startInd; i < startInd + groupSize; i++) {
                groups[i].squares.forEach((s) => multiGroup.addSquare(s));
                multiGroup.subGroups.add(groups[i]);
            }
            results.push(multiGroup);
        }
    }
}

export class BoardState {
    constructor(setup) {
        const setupFields = setup.split("/");
        const setupSplit = setupFields[0].split(",");

        const size = Math.sqrt(setupSplit.length);

        this.starCount = parseInt(setupFields[1]);
        this.board = new Array(size);
        for (let r = 0; r < size; r++) {
            this.board[r] = new Array(size);
        }

        const groupSquareGroups = new Array(size);
        for (let gg = 0; gg < groupSquareGroups.length; gg++) {
            groupSquareGroups[gg] = new SquareGroup("group" + gg.toString(), this.starCount);
        }

        const rowSquareGroups = new Array(size);
        for (let rg = 0; rg < rowSquareGroups.length; rg++) {
            rowSquareGroups[rg] = new SquareGroup("row" + rg.toString(), this.starCount);
        }

        const colSquareGroups = new Array(size);
        for (let cg = 0; cg < colSquareGroups.length; cg++) {
            colSquareGroups[cg] = new SquareGroup("col" + cg.toString(), this.starCount);
        }

        const squareGroups = []

        for (let x = 0; x < setupSplit.length; x++) {
            const j = x % size;
            const i = Math.floor(x / size);

            const group = setupSplit[x] - 1;
            const square = new SquareState(i, j, group);
            this.board[i][j] = square;

            groupSquareGroups[group].addSquare(square);
            rowSquareGroups[i].addSquare(square);
            colSquareGroups[j].addSquare(square);

            if (i > 0 && j > 0) {
                const boxGroup = new SquareGroup("box" + (i-1).toString() + "-" + (j-1).toString(), BOX_GROUP_STARCOUNT);
                boxGroup.addSquare(this.board[i-1][j-1]);
                boxGroup.addSquare(this.board[i][j-1]);
                boxGroup.addSquare(this.board[i-1][j]);
                boxGroup.addSquare(this.board[i][j]);
                squareGroups.push(boxGroup);
            }
        }

        generateMultiGroups(rowSquareGroups, squareGroups, "rows", this.starCount);
        generateMultiGroups(colSquareGroups, squareGroups, "cols", this.starCount);

        this.groups = new Set();
        squareGroups.forEach((g) => this.groups.add(g));
        groupSquareGroups.forEach((g) => this.groups.add(g));
        rowSquareGroups.forEach((g) => this.groups.add(g));
        colSquareGroups.forEach((g) => this.groups.add(g));

        this.profilingStats = {
            thinkTime: 0,
            cleanTime: 0,
            dedupeTime: 0,
            deepCopyTime: 0,
            advancedSplitTime: 0,
        };
    }
}


function findObvious(board, isGuess) {
    let changeType = CHANGE_TYPE.NO_CHANGE;
    board.groups.forEach((g) => {
        if (g.starCount === g.squares.size) {
            g.squares.forEach((s) => s.setValue(true, isGuess));
            changeType = CHANGE_TYPE.BOARD_CHANGE;
        }
    });
    return changeType;
}


function cleanBoard(board, isGuess) {

    let cleanChange = CHANGE_TYPE.NO_CHANGE;
    while (true) {
        const spitChange = split(board.groups, isGuess);
        if (spitChange === CHANGE_TYPE.NO_CHANGE) break;
        cleanChange = Math.max(cleanChange, spitChange);
    }
    cleanChange = Math.max(cleanChange, findObvious(board, isGuess))
    board.groups.forEach((g) => {
        if (g.starCount === 0) {
            g.squares.forEach((s) => s.setValue(false, isGuess))
        }
        if (g.squares.size === 0) {
            board.groups.delete(g);
            cleanChange = Math.max(cleanChange, CHANGE_TYPE.STATE_CHANGE)
        }
    });
    return cleanChange;
}


export function solve(board, setBoard, setMessage, isGuess) {
    let nextBoard = board;
    while (true) {
        nextBoard = think(nextBoard, setBoard, setMessage, isGuess, CHANGE_TYPE.SOLVE);
        if (!nextBoard) return;
    }
}

export function think(board, setBoard, setMessage, isGuess, stopOnChangeType) {
    const thinkStartTime = Date.now();
    if (!isGuess) console.log("=================");

    const cleanStartTime = Date.now();
    let changeType = cleanBoard(board, isGuess);
    board.profilingStats.cleanTime += Date.now() - cleanStartTime;
    if (changeType >= stopOnChangeType) {
        board.profilingStats.thinkTime += Date.now() - thinkStartTime;
        setMessage("Split");
        setBoard(_.clone(board));
        return board;
    }

    while (true) {
        const dedupeStartTime = Date.now();
        let dedupeChange = dedupe(board.groups, isGuess, stopOnChangeType);
        board.profilingStats.dedupeTime += Date.now() - dedupeStartTime;
        if (dedupeChange === CHANGE_TYPE.NO_CHANGE) break;
        if (dedupeChange >= stopOnChangeType) {
            board.profilingStats.thinkTime += Date.now() - thinkStartTime;
            setBoard(_.clone(board));
            setMessage("Dedupe");
            return board;
        }
    }

    const advancedSplitStartTime = Date.now();
    const advancedSplitChange = advancedSplit(board, isGuess);
    board.profilingStats.advancedSplitTime += Date.now() - advancedSplitStartTime;
    if (advancedSplitChange !== CHANGE_TYPE.NO_CHANGE) {
        board.profilingStats.thinkTime += Date.now() - thinkStartTime;
        if (advancedSplitChange >= stopOnChangeType) {
            setBoard(_.clone(board));
            setMessage("Advanced Split");
        }
        return board;
    }

    if (!isGuess) {
        const deepCopyStartTime = Date.now();
        let boardDeepCopy = _.cloneDeep(board);
        board.profilingStats.deepCopyTime += Date.now() - deepCopyStartTime;
        boardDeepCopy.profilingStats = board.profilingStats;

        for (let i = 0; i < board.board.length; i++) {
            for (let j = 0; j < board.board[0].length; j++) {

                if (board.board[i][j].value !== 0) {
                    continue;
                }
                const guessText = i + " " + j;
                console.log("Guessing " + guessText + "...");

                board.board[i][j].setValue(true, true);

                try {
                    solve(board, setBoard, setMessage, true, CHANGE_TYPE.SOLVE);
                    if (board.groups.size === 0) {
                        board.profilingStats.thinkTime += Date.now() - thinkStartTime;
                        setBoard(_.clone(board));
                        setMessage("Guess succeeded. " + guessText + " Solved!");
                        return;
                    }
                } catch (err) {
                    console.log("Guess breaks: " + guessText + " " + err.toString());
                    boardDeepCopy.board[i][j].setValue(false, false);
                    board = boardDeepCopy;
                    board.profilingStats.thinkTime += Date.now() - thinkStartTime;
                    if (stopOnChangeType <= CHANGE_TYPE.BOARD_CHANGE) {
                        setMessage("Guess failed");
                        setBoard(board);
                    }
                    return board;
                }

                console.log("Guessing undetermined");
                board = boardDeepCopy;
                const deepCopyStartTime = Date.now();
                boardDeepCopy = _.cloneDeep(boardDeepCopy);
                board.profilingStats.deepCopyTime += Date.now() - deepCopyStartTime;
                boardDeepCopy.profilingStats = board.profilingStats;
            }
        }
    } else {
        return;
    }

    const clean2StartTime = Date.now();
    cleanBoard(board, isGuess);
    board.cleanTime += Date.now() - clean2StartTime;
    if (board.groups.size === 0) {
        board.profilingStats.thinkTime += Date.now() - thinkStartTime;
        setBoard(_.clone(board));
        setMessage("Solved.");
        return;
    }

    board.profilingStats.thinkTime += Date.now() - thinkStartTime;
    setBoard(_.clone(board));
    setMessage("Stumped.");
}

