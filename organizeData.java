import java.io.BufferedReader;
import java.io.File; // Import the File class
import java.io.FileInputStream;
import java.io.FileNotFoundException; // Import this class to handle errors
import java.io.FileReader;
import java.io.InputStream;
import java.util.Scanner; // Import the Scanner class to read text files
import java.io.PrintWriter;

public class organizeData{  

    public static String data;
    public static void main(String[] args){  
        try {
            File myObj = new File("sentiment140.csv");
            BufferedReader myReader = new BufferedReader(new FileReader(myObj));
            PrintWriter csv = new PrintWriter(new File("sadness.csv"));
            StringBuilder sb = new StringBuilder();
            Integer i = 0;
            while (myReader.readLine() != null) {
                data = myReader.readLine();
                String[] dataArray = data.split(",");
                sb.setLength(0);
                sb.append(dataArray[5]);
                sb.append(",");
                sb.append(Integer.parseInt(dataArray[0].replace("\"", "")));
                sb.append("\n");
                csv.write(sb.toString());
                i++;
            }
            myReader.close();
        } catch (Exception e) {
            System.out.println(data);
            e.printStackTrace();
        }
    }  
}  