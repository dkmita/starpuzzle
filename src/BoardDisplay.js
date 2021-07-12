import React, { useState } from 'react';
import './BoardDisplay.css';
import classNames from 'classnames';
import { BoardState, solve, think, CHANGE_TYPE } from './Logic';

import _ from 'lodash';
import star from './star.png';
import PuzzleDropdown from "./DropdownDisplay";

/*
let board2 = fetch("https://www.puzzle-star-battle.com/?e=MDozLDk3NiwxMjE=") //, {mode: 'no-cors'})
    .then(data => console.log(data.toString()))
    .catch(data => {
      console.log("error");
      console.log(data);
    })
console.log(board2);

const board = [[0, 0, 0, 0, 0],
  [1, 0, 0, 0, 0],
  [1, 2, 2, 0, 0],
  [3, 2, 2, 4, 4],
  [3, 3, 2, 4, 4]];
*/

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});


const initSetup = "1,1,1,2,2,2,2,3,3,3,1,1,1,1,4,4,4,3,3,3,1,1,1,5,5,4,4,3,3,3,1,5,5,5,5,4,4,3,3,3,1,5,5,5,6,6,4,4,3,3,7,5,5,5,6,6,8,8,8,8,7,7,5,5,9,6,8,8,8,8,7,7,7,7,9,6,8,8,8,8,7,7,10,10,9,9,9,9,8,8,10,10,10,10,9,9,9,9,8,8/2";

function BoardDisplay() {
  const [setup, setSetup] = useState(initSetup);
  const [board, setBoard] = useState(new BoardState(setup));
  const [message, setMessage] = useState("Welcome!");
  const [hoverSquare, setHoverSquare] = useState(undefined);
  const [hoverGroup, setHoverGroup] = useState(undefined);



  const rows = _.map(board.board, (row, i) => Row(board, setBoard, hoverSquare, setHoverSquare, hoverGroup, row, i));
  const groups = _.map(Array.from(board.groups.values()), (g) => new GroupDisplay(g, setHoverGroup, board, hoverSquare))

  return (
    <div>
      <div className="board-container">
        <div className="board-controller">
          {PuzzleDropdown((e, d) => {
            setBoard(new BoardState(d.value));
            setSetup(d.value);
          })}
          <div className="think" onClick={() => think(board, setBoard, setMessage, false, CHANGE_TYPE.STATE_CHANGE)}><strong>Debug</strong></div>
          <div className="think" onClick={() => think(board, setBoard, setMessage, false, CHANGE_TYPE.BOARD_CHANGE)}><strong>Step</strong></div>
          <div className="think" onClick={() => solve(board, setBoard, setMessage)}><strong>Solve</strong></div>
          <div className="board">
            {rows}
          </div>
          {message}
          <div className="think" onClick={() => setBoard(new BoardState(setup))}><strong>Reset</strong></div>
          <div><strong>Think Time: {board.profilingStats.thinkTime}ms</strong></div>
          <div>Clean Time: {board.profilingStats.cleanTime}ms</div>
          <div>Dedupe Time: {board.profilingStats.dedupeTime}ms</div>
          <div>Deep Copy Time: {board.profilingStats.deepCopyTime}ms</div>
          <div>Advanced Split Time: {board.profilingStats.advancedSplitTime}ms</div>
        </div>
        <div className="groups">
          <strong>Groups: {groups.length}</strong>
          <div className="groups-list">{groups}</div>
        </div>
      </div>
    </div>
  );
}


function Row(board, setBoard, hoverSquare, setHoverSquare, hoverGroup, row, i) {
  const squares = _.map(row, (v, j) => Square(board, setBoard, hoverSquare, setHoverSquare, hoverGroup, i, j));
  return (
    <div key={"row" + i.toString()} className="row">
      {squares}
    </div>
  );
}


function move(board, i, j, setBoard) {
  const boardCopy = _.clone(board);
  boardCopy.board[i][j].value = (boardCopy.board[i][j].value + 1) % 3;
  setBoard(boardCopy);
}


function displayMoveValue(moveValue) {
  if (moveValue === 0) {
    return <span>&nbsp;</span>;
  }
  if (moveValue === 1) {
    return <div className="x">x</div>;
  }
  else return <img className="star" alt="star" src={star} />;
}


function Square(board, setBoard, hoverSquare, setHoverSquare, hoverGroup, i, j) {

  const b = board.board;
  const s = b[i][j];
  const valueDisplay = s.value;
  const group = s.group;
  const classes = classNames({
    square: true,
    top: i === 0 || group !== b[i-1][j].group,
    left: j === 0 || group !== b[i][j-1].group,
    bottom: i === b.length - 1 || group !== b[i+1][j].group,
    right: j === b[0].length - 1 || group !== b[i][j+1].group,
    groupHover: hoverGroup && hoverGroup.squares.has(s),
    lastHover: hoverSquare === s
  });

  return (
      <div key={`square${i}+${j}`}
             className={classes}
           onClick={() => {
             setHoverSquare(s);
             move(board, i, j, setBoard)
           }}>
           {displayMoveValue(valueDisplay)}
      </div>
  );
}

function GroupDisplay(group, setHoverGroup, board, hoverSquare) {
  if (hoverSquare && !group.squares.has(hoverSquare)) {
    return <div key={"group" + group.name} />
  }
  const squares = _.map([...group.squares], (s, i) => i < 20 ? <span key={"groupSquare" + group.name + s.i.toString() + "-" + s.j.toString()}>({s.i}, {s.j})&nbsp;</span> : ".")
  return <div
      key={"group" + group.name}
      onMouseEnter={() => setHoverGroup(group)}
      onMouseLeave={() => setHoverGroup(null)}>
    {group.name} ({group.starCount}): {squares}
  </div>
}


export default BoardDisplay;