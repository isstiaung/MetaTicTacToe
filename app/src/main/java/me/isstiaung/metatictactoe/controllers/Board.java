package me.isstiaung.metatictactoe.controllers;

import static me.isstiaung.metatictactoe.utils.Utils.log;

/**
 * Created by sainathrajagopal on 04/09/18.
 */

public class Board {
    int status[][];

    int winner=-1;

    public Board(){
        status = new int[3][3];
        initializeBoardStatus();

    }

    public int getWinner(){
        return winner;
    }

    public int getStatus(int x, int y){
        return status[x][y];
    }

    public void setStatus(boolean turn, int x, int y){
        if(turn){
            status[x][y]=1;
        }
        else{
            status[x][y]=0;
        }
    }

    public void resetStatus(){
        initializeBoardStatus();
    }

    private void initializeBoardStatus(){
        for(int i = 0; i < 3; i++){
            for(int j = 0; j < 3; j++){
                status[i][j] = -1;
            }
        }
    }

    public boolean isBoardWon(){
        //Horizontal --- rows
        for(int i=0; i<3; i++){
            if(status[i][0] == status[i][1] && status[i][0] == status[i][2]){
                if (status[i][0]==1){
                    log("Player X winner\n" + (i+1)+" row");
                    winner = 1;
                    return true;
                }
                else if (status[i][0]==0) {
                    log("Player 0 winner\n" + (i+1)+" row");
                    winner = 0;
                    return true;
                }
            }
        }

        //Vertical --- columns
        for(int i=0; i<3; i++){
            if(status[0][i] == status[1][i] && status[0][i] == status[2][i]){
                if (status[0][i]==1){
                    winner = 1;
                    return true;
                }
                else if (status[0][i]==0) {
                    winner = 0;
                    return true;
                }
            }
        }

        //First diagonal
        if(status[0][0] == status[1][1] && status[0][0] == status[2][2]){
            if (status[0][0]==1){
                winner = 1;
                return true;
            }
            else if (status[0][0]==0) {
                winner = 0;
                return true;
            }
        }

        //Second diagonal
        if(status[0][2] == status[1][1] && status[0][2] == status[2][0]){
            if (status[0][2]==1){
                winner = 1;
                return true;
            }
            else if (status[0][2]==0) {
                winner = 0;
                return true;
            }
        }
        return false;
    }
}
