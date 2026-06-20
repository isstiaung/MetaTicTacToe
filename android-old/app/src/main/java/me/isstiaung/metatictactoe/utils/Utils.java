package me.isstiaung.metatictactoe.utils;

import android.util.Log;

/**
 * Created by sainathrajagopal on 01/09/18.
 */

public class Utils {
    static boolean DEBUG = false;
    public static String TAG = "TicTacToe";

    public static void log(String message){
        if(DEBUG)
            Log.i(TAG, message);
    }
}
