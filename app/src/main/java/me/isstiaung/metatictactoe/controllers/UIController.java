package me.isstiaung.metatictactoe.controllers;

import android.annotation.SuppressLint;
import android.view.View;
import android.widget.Button;
import android.widget.ImageButton;
import android.widget.TextView;
import android.widget.Toast;

import me.isstiaung.metatictactoe.LandingActivity;
import me.isstiaung.metatictactoe.MainBoardActivity;
import me.isstiaung.metatictactoe.R;
import me.isstiaung.metatictactoe.ui.EntireBoard;
import me.isstiaung.metatictactoe.ui.SingleBoard;

import static me.isstiaung.metatictactoe.utils.Utils.log;

/**
 * Created by sainathrajagopal on 03/09/18.
 */

public class UIController implements View.OnClickListener{

    MainBoardActivity mainBoardActivity;
    static boolean turn=true;
    EntireBoard entireBoard;
    SwitchHandler switchHandler;
    Button reset;
    ImageButton back;
    TextView explain;

    public UIController(MainBoardActivity mainBoardActivity){
        this.mainBoardActivity = mainBoardActivity;
        switchHandler = new SwitchHandler();
    }

    public void start(){
        entireBoard = mainBoardActivity.findViewById(R.id.entire_board);
        entireBoard.setAllClickListeners(this);
        reset = mainBoardActivity.findViewById(R.id.resetGame);
        reset.setOnClickListener(this);
        back = mainBoardActivity.findViewById(R.id.back);
        back.setOnClickListener(this);
        explain = mainBoardActivity.findViewById(R.id.explain);
    }

    View getSingleBoard(View v){
        View ideallyTableRow = (View) v.getParent();
        View ideallyTableLayout = (View) ideallyTableRow.getParent();
        View ideallyLinearLayout = (View) ideallyTableLayout.getParent();
        View ideallyBoard = (View) ideallyLinearLayout.getParent();
        return ideallyBoard;
    }

    void processTurn(View v){
        try {
            View ideallyBoard = getSingleBoard(v);
            int boardNo = switchHandler.getBoardNo(ideallyBoard.getId());
            if(boardNo == -1){
                boardNo = switchHandler.getBoardNo(v.getId());
            }
            SingleBoard selected = entireBoard.getBoard(boardNo);
            int cellNo = switchHandler.getCellNo(v.getId());
            if(cellNo!=-1) {
                selected.handleMove(mainBoardActivity, turn, cellNo);
                changeTurn();
                entireBoard.disableOtherBoards(cellNo);
            }
        }
        catch(Exception e){
            log(e.getMessage());
        }
    }

    void changeTurn(){
        TextView tv = (TextView) mainBoardActivity.findViewById(R.id.turnView);
        if(turn) {
            tv.setTextColor(mainBoardActivity.getResources().getColor(android.R.color.holo_blue_dark));
            tv.setText("O's Turn");
        }
        else {
            tv.setTextColor(mainBoardActivity.getResources().getColor(android.R.color.holo_red_dark));
            tv.setText("X's Turn");
        }
        turn=!turn;
    }

    @SuppressLint("SetTextI18n")
    @Override
    public void onClick(View v) {
        if(v.getId()==R.id.resetGame){
            entireBoard.resetBoards();
            turn=false;
            changeTurn();
            explain.setText("First move on any board");
        }
        else if(v.getId()==R.id.back){
            mainBoardActivity.startLandingActivity();
        }
        else{
            processTurn(v);
        }
    }
}
