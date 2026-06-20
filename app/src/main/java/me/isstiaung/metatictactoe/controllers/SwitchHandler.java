package me.isstiaung.metatictactoe.controllers;

import me.isstiaung.metatictactoe.R;

import static me.isstiaung.metatictactoe.utils.Utils.log;

/**
 * Created by sainathrajagopal on 04/09/18.
 */

public class SwitchHandler {
    public int getBoardNo(int viewID){
        switch (viewID) {
            case R.id.board00:
                return 1;
            case R.id.board01:
                return 2;
            case R.id.board02:
                return 3;
            case R.id.board10:
                return 4;
            case R.id.board11:
                return 5;
            case R.id.board12:
                return 6;
            case R.id.board20:
                return 7;
            case R.id.board21:
                return 8;
            case R.id.board22:
                return 9;
            default:
                return -1;
        }
    }

    public int getCellNo(int viewID){
        switch (viewID) {
            case R.id.b00:
                return 1;
            case R.id.b01:
                return 2;
            case R.id.b02:
                return 3;
            case R.id.b10:
                return 4;
            case R.id.b11:
                return 5;
            case R.id.b12:
                return 6;
            case R.id.b20:
                return 7;
            case R.id.b21:
                return 8;
            case R.id.b22:
                return 9;
            default:
                return -1;
        }
    }
}
