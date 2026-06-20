package me.isstiaung.metatictactoe.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.util.AttributeSet;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.RelativeLayout;

import me.isstiaung.metatictactoe.R;
import me.isstiaung.metatictactoe.controllers.Board;
import me.isstiaung.metatictactoe.controllers.SwitchHandler;

import static me.isstiaung.metatictactoe.utils.Utils.log;

/**
 * Created by sainathrajagopal on 16/08/18.
 */

public class SingleBoard extends RelativeLayout {

    Button[][] cells;

    SwitchHandler switchHandler;
    Board board;
    RelativeLayout overlay,circle,shapex;
    int winner = -1;
    boolean reset=false;

    boolean boardDone=false;

    public boolean isBoardDone(){
        return boardDone;
    }

    public void disableOverLay(){
        overlay.setEnabled(false);
        overlay.setVisibility(INVISIBLE);
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                if(cells[i][j].getText().equals(""))
                    cells[i][j].setEnabled(true);
            }
        }
    }

    public void enableOverlay(){
        overlay.setEnabled(true);
        overlay.setVisibility(VISIBLE);
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                cells[i][j].setEnabled(false);
            }
        }
    }

    void disableX(){
        shapex.setEnabled(false);
        shapex.setVisibility(INVISIBLE);
    }

    void disableO(){
        circle.setVisibility(INVISIBLE);
        circle.setEnabled(false);
    }

    public void init(){
        overlay = this.findViewById(R.id.transparentOverlay);
        circle = this.findViewById(R.id.circleWin);
        shapex = this.findViewById(R.id.xWin);
        disableO();
        disableX();
        disableOverLay();
    }

    public SingleBoard(Context context, AttributeSet attrs) {
        super(context, attrs);
        cells = new Button[3][3];
        switchHandler = new SwitchHandler();
        board = new Board();
    }

    public void resetBoard(){
        reset=true;
        boardDone=false;
        board.resetStatus();
        disableX();
        disableO();
        disableOverLay();
        for(int i=0;i<3;i++){
            for(int j=0;j<3;j++){
                cells[i][j].setText("");
                cells[i][j].setEnabled(true);
            }
        }
    }

    void setOnClickListener(View v, OnClickListener onClickListener){
        v.setOnClickListener(onClickListener);
    }

    public void setButtonListeners(OnClickListener onClickListener){
        cells[0][0] = this.findViewById(R.id.b00);
        setOnClickListener(cells[0][0],onClickListener);

        cells[0][1] = this.findViewById(R.id.b01);
        setOnClickListener(cells[0][1],onClickListener);

        cells[0][2] = this.findViewById(R.id.b02);
        setOnClickListener(cells[0][2],onClickListener);

        cells[1][0] = this.findViewById(R.id.b10);
        setOnClickListener(cells[1][0],onClickListener);

        cells[1][1] = this.findViewById(R.id.b11);
        setOnClickListener(cells[1][1],onClickListener);

        cells[1][2] = this.findViewById(R.id.b12);
        setOnClickListener(cells[1][2],onClickListener);

        cells[2][0] = this.findViewById(R.id.b20);
        setOnClickListener(cells[2][0],onClickListener);

        cells[2][1] = this.findViewById(R.id.b21);
        setOnClickListener(cells[2][1],onClickListener);

        cells[2][2] = this.findViewById(R.id.b22);
        setOnClickListener(cells[2][2],onClickListener);
    }

    Button getAndSetCell(boolean turn, int cellNo){
        switch(cellNo){
            case 1:
                board.setStatus(turn,0,0);
                return cells[0][0];
            case 2:
                board.setStatus(turn,0,1);
                return cells[0][1];
            case 3:
                board.setStatus(turn,0,2);
                return cells[0][2];
            case 4:
                board.setStatus(turn,1,0);
                return cells[1][0];
            case 5:
                board.setStatus(turn,1,1);
                return cells[1][1];
            case 6:
                board.setStatus(turn,1,2);
                return cells[1][2];
            case 7:
                board.setStatus(turn,2,0);
                return cells[2][0];
            case 8:
                board.setStatus(turn,2,1);
                return cells[2][1];
            case 9:
                board.setStatus(turn,2,2);
                return cells[2][2];
            default:
                board.setStatus(turn,1,1);
                return cells[1][1];
        }
    }

    public void handleMove(Context context, boolean turn, int cellNo){
        Button clicked = getAndSetCell(turn, cellNo);
        setCellText(clicked, context, turn);
        checkBoardWon();
    }

    void checkBoardWon(){
        boardDone = board.isBoardWon();
        if(boardDone) {
            winner = board.getWinner();
            enableOverlay();
            if (winner == 0) {
                drawO();
            } else if (winner == 1) {
                drawX();
            }
        }
    }

    public void setCellText(Button clicked, Context context, boolean turn){
        if(turn){
            clicked.setTextColor(context.getResources().getColor(android.R.color.holo_red_dark));
            clicked.setText("X");
            clicked.setEnabled(false);
        }
        else{
            clicked.setTextColor(context.getResources().getColor(android.R.color.holo_blue_dark));
            clicked.setText("O");
            clicked.setEnabled(false);
        }
    }

    void drawO(){
        circle.setVisibility(VISIBLE);
    }

    void drawX(){
        shapex.setVisibility(VISIBLE);
    }
}
