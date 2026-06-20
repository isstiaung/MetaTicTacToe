package me.isstiaung.metatictactoe.ui;

import android.app.Dialog;
import android.content.Context;
import android.content.DialogInterface;
import android.graphics.drawable.ColorDrawable;
import android.support.v7.app.AlertDialog;
import android.util.AttributeSet;
import android.view.View;
import android.view.Window;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import me.isstiaung.metatictactoe.R;
import me.isstiaung.metatictactoe.controllers.Board;

import static me.isstiaung.metatictactoe.utils.Utils.log;

/**
 * Created by sainathrajagopal on 16/08/18.
 */

public class EntireBoard extends LinearLayout {

    SingleBoard[][] singleBoards;

    Board board;
    int winner = -1;
    boolean boardDone=false;
    TextView explain ;

    public EntireBoard(Context context, AttributeSet attrs) {
        super(context,attrs);
        singleBoards = new SingleBoard[3][3];
        board = new Board();
    }


    void setOnClickListener(View v, OnClickListener onClickListener){
        v.setOnClickListener(onClickListener);
    }

    void setBoardListeners(SingleBoard board, OnClickListener onClickListener){
        explain = findViewById(R.id.explain);
        setOnClickListener(board,onClickListener);
        board.setButtonListeners(onClickListener);
        board.init();
    }

    public void resetBoards(){
        board.resetStatus();
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                singleBoards[i][j].resetBoard();
            }
        }
    }

    void showCongratulations(){
        String playerWinner;
        if(winner==0)
            playerWinner="O";
        else
            playerWinner="X";
        AlertDialog alertDialog = new AlertDialog.Builder(getContext()).create();
        alertDialog.setTitle("Congratulations!");
        alertDialog.setMessage(playerWinner + " wins!");
        alertDialog.setButton(AlertDialog.BUTTON_NEUTRAL, "OK",
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        dialog.dismiss();
                    }
                });
        alertDialog.show();
        explain.setText(playerWinner + " wins!");
    }

    void checkBoardWon(){
        boardDone = board.isBoardWon();
        if(boardDone) {
            winner = board.getWinner();
            log("Winner is " + winner);
            disableAllBoards();
            showCongratulations();
        }
        else{
            if(areAllBoardsDone()){
                disableAllBoards();
                showDraw();
            }
        }
    }

    void showDraw(){
        AlertDialog alertDialog = new AlertDialog.Builder(getContext()).create();
        alertDialog.setTitle("Nobody wins!");
        alertDialog.setMessage("It's a draw");
        alertDialog.setButton(AlertDialog.BUTTON_NEUTRAL, "OK",
                new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface dialog, int which) {
                        dialog.dismiss();
                    }
                });
        alertDialog.show();
       // Toast.makeText(getContext(),"Nobody wins", Toast.LENGTH_LONG).show();
        explain.setText("It's a draw!");
    }

    boolean areAllBoardsDone(){
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                if(!singleBoards[i][j].isBoardDone())
                    return false;
            }
        }
        return true;
    }

    void disableAllBoards(){
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                singleBoards[i][j].enableOverlay();
            }
        }
    }

    public void disableOtherBoards(int boardNo){
        if(getBoard(boardNo).isBoardDone()){
            explain.setText("Next move on any board");
            for(int i=0;i<3;i++){
                for(int j=0;j<3;j++){
                    if(!singleBoards[i][j].isBoardDone()) {
                        singleBoards[i][j].disableOverLay();
                    }
                    else {
                        singleBoards[i][j].enableOverlay();
                    }
                }
            }
        }
        else {
            for (int i = 0; i < 3; i++) {
                for (int j = 0; j < 3; j++) {
                    singleBoards[i][j].enableOverlay();
                }
            }
            explain.setText("Next move on board no " + boardNo);
            getBoard(boardNo).disableOverLay();
        }
        checkIfSingleBoardsDone();
        checkBoardWon();
    }

    void checkIfSingleBoardsDone(){
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                boolean turn = false;
                if(singleBoards[i][j].isBoardDone()) {
                    if (singleBoards[i][j].winner == 0)
                        turn = false;
                    else if (singleBoards[i][j].winner == 1)
                        turn = true;
                    log("Setting status of " + turn + " at i " + i + " and j " + j);
                    board.setStatus(turn, i, j);
                }
            }
        }
    }

    public void setAllClickListeners(OnClickListener onClickListener){

        setOnClickListener(this,onClickListener);

        singleBoards[0][0] = this.findViewById(R.id.board00);
        setBoardListeners(singleBoards[0][0], onClickListener);

        singleBoards[0][1] = this.findViewById(R.id.board01);
        setBoardListeners(singleBoards[0][1], onClickListener);

        singleBoards[0][2] = this.findViewById(R.id.board02);
        setBoardListeners(singleBoards[0][2], onClickListener);

        singleBoards[1][0] = this.findViewById(R.id.board10);
        setBoardListeners(singleBoards[1][0], onClickListener);

        singleBoards[1][1] = this.findViewById(R.id.board11);
        setBoardListeners(singleBoards[1][1], onClickListener);

        singleBoards[1][2] = this.findViewById(R.id.board12);
        setBoardListeners(singleBoards[1][2], onClickListener);

        singleBoards[2][0] = this.findViewById(R.id.board20);
        setBoardListeners(singleBoards[2][0], onClickListener);

        singleBoards[2][1] = this.findViewById(R.id.board21);
        setBoardListeners(singleBoards[2][1], onClickListener);

        singleBoards[2][2] = this.findViewById(R.id.board22);
        setBoardListeners(singleBoards[2][2], onClickListener);

    }

    public SingleBoard getBoard(int boardID){
        switch (boardID){
            case 1:
                return singleBoards[0][0];
            case 2:
                return singleBoards[0][1];
            case 3:
                return singleBoards[0][2];
            case 4:
                return singleBoards[1][0];
            case 5:
                return singleBoards[1][1];
            case 6:
                return singleBoards[1][2];
            case 7:
                return singleBoards[2][0];
            case 8:
                return singleBoards[2][1];
            case 9:
                return singleBoards[2][2];
            default:
                return singleBoards[1][1];
        }
    }
}
