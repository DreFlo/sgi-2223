import { MyCheckerboard as MyCheckerboardModel } from "../../model/MyCheckerboard.js";
import { MyCheckerboard as MyCheckerboardView } from "../../view/board/MyCheckerboard.js";
import { MyKeyframe } from "../../view/animations/MyKeyframe.js";
import { MyKeyframeAnimation } from "../../view/animations/MyKeyframeAnimation.js";
import { MyMoveAnimation } from "../../view/animations/MyMoveAnimation.js";

/**
 * MyCommand class, class for moves related to the checkers game.
 * @constructor
 * @param {MyCheckerboardModel} boardModel - boardModel Model
 * @param {MyCheckerboardView} boardView - boardModel View
 * @param {number} row - row of the piece to be moved
 * @param {number} col - column of the piece to be moved
 * @param {number} newRow - row of the piece's new position
 * @param {number} newCol - column of the piece's new position
 * @param {MyCheckerboardView} auxBoardView0 - Player 1's auxBoardView
 * @param {MyCheckerboardView} auxBoardView1 - Player 2's auxBoardView
 */
export class MyCommand {
    constructor(boardModel, boardView, row, col, newRow, newCol, auxBoardView0, auxBoardView1) {
        this.boardModel = boardModel;
        this.boardView = boardView;
        this.row = row;
        this.col = col;
        this.newRow = newRow;
        this.newCol = newCol;
        this.auxBoardView0 = auxBoardView0;
        this.auxBoardView1 = auxBoardView1;
        this.moveNumber = -1;
    }

    /**
     * Execute the command.
     * @returns {void}
     * @throws {Error} - If the command is invalid
     * @public
     */
    execute() {
        this.moveNumber = this.boardModel.makeMove(this.row, this.col, this.newRow, this.newCol)
        console.log(this.moveNumber);
        if (this.moveNumber != -1) {
            var lastMove = this.boardModel.getLastMoveRecord()
            if(lastMove.capturedPiece != null){
                let rowDiff = lastMove.newRow - lastMove.row;
                let colDiff = lastMove.newCol - lastMove.col;

                if(lastMove.playerNumberBefore == 1)
                    this.boardView.currentAnimation = new MyMoveAnimation(this.boardView.scene, [this.col, this.row], [this.newCol, this.newRow], this.boardView.transformation, [lastMove.col + colDiff / 2, lastMove.row + rowDiff / 2], this.auxBoardView0);
                else
                    this.boardView.currentAnimation = new MyMoveAnimation(this.boardView.scene, [this.col, this.row], [this.newCol, this.newRow], this.boardView.transformation, [lastMove.col + colDiff / 2, lastMove.row + rowDiff / 2], this.auxBoardView1);
            }
               
            else
                this.boardView.currentAnimation = new MyMoveAnimation(this.boardView.scene, [this.col, this.row], [this.newCol, this.newRow], this.boardView.transformation);
        }
        else {
            // TODO User feedback
        }
    }

    /**
     * Undo the command.
     * @returns {void}
     * @throws {Error} - If the command is invalid
     * @public
     */
    undo() {
        this.boardModel.undoMove(this.moveNumber);
        this.auxBoardView0.resetPieces();
        this.auxBoardView1.resetPieces();
        this.boardView.setBoardViewPieces();
    }

    redo() {
        this.execute();
    }
}